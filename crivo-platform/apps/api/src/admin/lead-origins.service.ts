import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PLATFORM_LEAD_ORIGINS,
  type PlatformLeadOriginOption,
  type PlatformLeadOriginUpsertRequest,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

/** Códigos das 7 origens que vivem no código e não podem ser excluídas. */
const BUILTIN = new Set<string>(PLATFORM_LEAD_ORIGINS.map((o) => o.value));

/**
 * Catálogo de ORIGENS/CANAIS do lead (Governança · Origens e Canais).
 *
 * Mesmo desenho do catálogo de Adicionais: a lista fixa do código continua sendo a
 * base e o banco COMPLEMENTA. `list()` devolve a união —
 *   • as 7 canônicas (`PLATFORM_LEAD_ORIGINS`), sempre presentes, `builtin: true`;
 *   • as cadastradas pelo super admin, `builtin: false`.
 *
 * Uma canônica também pode ganhar linha no banco: aí a linha só sobrescreve o
 * rótulo e a ativação — ela continua `builtin`, e continua impossível de excluir.
 *
 * `platform_leads.origin` NÃO vira chave estrangeira. Este catálogo alimenta o
 * seletor; ele não restringe o que já está gravado. Um lead antigo com origem
 * legada ("lp-diagnostico", "qrcode") continua válido e continua sendo exibido —
 * era assim antes desta tela existir e continua sendo.
 */
@Injectable()
export class LeadOriginsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lista o catálogo: canônicas do código + cadastradas. */
  async list(): Promise<PlatformLeadOriginOption[]> {
    const rows = await this.prisma.admin.platformLeadOriginOption.findMany();
    const byValue = new Map(rows.map((r) => [r.value, r]));

    // Canônicas primeiro, na ordem em que estão no código (é a ordem que o CRM
    // sempre mostrou). Se houver linha no banco para a mesma, ela manda no rótulo
    // e na ativação — sem deixar de ser embutida.
    const canonicas: PlatformLeadOriginOption[] = PLATFORM_LEAD_ORIGINS.map((o) => {
      const row = byValue.get(o.value);
      return {
        value: o.value,
        label: row?.label ?? o.label,
        active: row?.active ?? true,
        builtin: true,
      };
    });

    // Cadastradas: tudo que está no banco e não é canônica.
    const cadastradas: PlatformLeadOriginOption[] = rows
      .filter((r) => !BUILTIN.has(r.value))
      .map((r) => ({ value: r.value, label: r.label, active: r.active, builtin: false }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

    return [...canonicas, ...cadastradas];
  }

  /**
   * Cadastra uma origem nova ou edita uma existente (rótulo e ativação).
   *
   * O `value` é o código que vai para `platform_leads.origin`: normalizado para
   * MAIÚSCULAS com underscore, no mesmo formato das canônicas (LANDING_PAGE), para
   * que uma origem cadastrada seja indistinguível de uma embutida no resto do
   * sistema — inclusive no agrupamento "Conversão por origem".
   */
  async upsert(
    value: string,
    dto: PlatformLeadOriginUpsertRequest,
    actor: Actor,
  ): Promise<PlatformLeadOriginOption> {
    const code = this.normalize(value);
    if (!/^[A-Z0-9][A-Z0-9_]{1,39}$/.test(code)) {
      throw new BadRequestException(
        'Código da origem inválido (2 a 40 caracteres: letras, números e underscore)',
      );
    }

    const existing = await this.prisma.admin.platformLeadOriginOption.findUnique({
      where: { value: code },
    });
    const canonica = PLATFORM_LEAD_ORIGINS.find((o) => o.value === code);
    const label = dto.label?.trim() || existing?.label || canonica?.label || '';
    if (!label) throw new BadRequestException('Informe o nome da origem');

    const active = dto.active ?? existing?.active ?? true;
    const saved = await this.prisma.admin.platformLeadOriginOption.upsert({
      where: { value: code },
      create: { value: code, label, active },
      update: { label, active },
    });

    await this.audit.record({
      action: 'lead-origin.upsert',
      actor,
      target: code,
      meta: { label: saved.label, active: saved.active, builtin: BUILTIN.has(code) },
    });

    return { value: saved.value, label: saved.label, active: saved.active, builtin: BUILTIN.has(code) };
  }

  /**
   * Exclui uma origem cadastrada.
   *
   * Duas recusas de propósito, as duas para não perder informação já gravada:
   *  • canônica não sai — ela vem do código, e sumiria da lista sem ninguém
   *    conseguir trazê-la de volta pela tela. Para tirá-la do seletor, desative;
   *  • origem EM USO não sai — os leads guardam o código, não o rótulo. Apagar o
   *    cadastro faria o funil voltar a exibir "INSTAGRAM" cru no lugar de
   *    "Instagram" nos leads que já vieram por ali. Desativar tira do seletor e
   *    preserva o rótulo de quem já tem.
   */
  async remove(value: string, actor: Actor): Promise<{ ok: true }> {
    const code = this.normalize(value);
    if (BUILTIN.has(code)) {
      throw new BadRequestException(
        'Origem embutida não pode ser excluída — desative-a para tirá-la do seletor',
      );
    }

    const existing = await this.prisma.admin.platformLeadOriginOption.findUnique({
      where: { value: code },
    });
    if (!existing) throw new NotFoundException('Origem não encontrada');

    const emUso = await this.prisma.admin.platformLead.count({ where: { origin: code } });
    if (emUso > 0) {
      throw new ConflictException(
        `${emUso} lead(s) já usam esta origem — desative-a em vez de excluir, para não perder o nome dela no histórico`,
      );
    }

    await this.prisma.admin.platformLeadOriginOption.delete({ where: { value: code } });
    await this.audit.record({
      action: 'lead-origin.delete',
      actor,
      target: code,
      meta: { label: existing.label },
    });
    return { ok: true };
  }

  /** "Google Ads" → "GOOGLE_ADS". Acentos caem; o resto vira underscore. */
  private normalize(value: string): string {
    return (value ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  }
}
