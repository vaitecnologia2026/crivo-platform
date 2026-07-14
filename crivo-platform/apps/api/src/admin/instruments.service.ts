import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
// Slugs dos built-in (valores históricos do enum) — reservados e imutáveis.
const RESERVED = ['PRE_DIAGNOSTIC', 'PSYCHOSOCIAL'];

export type InstrumentInput = {
  slug?: string;
  name?: string;
  bandKind?: 'MATURITY' | 'RISK';
  aggregation?: 'MEDIA_PONDERADA' | 'MEDIA_SIMPLES' | 'SOMA_NORMALIZADA';
  description?: string | null;
  active?: boolean;
};

/**
 * Catálogo de instrumentos de diagnóstico (motor dinâmico — call 14/07).
 * O cliente cria diagnósticos novos SEM depender de dev; o conteúdo
 * (dimensões/perguntas/faixas) continua na metodologia versionada.
 */
@Injectable()
export class InstrumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.admin.diagnosticInstrument.findMany({
      orderBy: [{ builtIn: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { versions: true } } },
    });
  }

  async create(dto: InstrumentInput, actor: Actor) {
    const slug = dto.slug?.trim().toLowerCase() ?? '';
    const name = dto.name?.trim() ?? '';
    if (!name) throw new BadRequestException('Informe o nome do diagnóstico.');
    if (!SLUG_RE.test(slug)) {
      throw new BadRequestException('Slug inválido: use letras minúsculas, números e hífen (3–40 caracteres).');
    }
    if (RESERVED.includes(slug.toUpperCase())) throw new BadRequestException('Slug reservado.');
    const exists = await this.prisma.admin.diagnosticInstrument.findUnique({ where: { slug } });
    if (exists) throw new BadRequestException('Já existe um diagnóstico com este slug.');

    const created = await this.prisma.admin.diagnosticInstrument.create({
      data: {
        slug,
        name,
        bandKind: dto.bandKind ?? 'MATURITY',
        aggregation: dto.aggregation ?? 'MEDIA_PONDERADA',
        description: dto.description ?? null,
        active: dto.active ?? true,
        builtIn: false,
      },
    });
    await this.audit.record({ action: 'instrument.create', actor, target: slug, meta: { name } });
    return created;
  }

  async update(slug: string, dto: InstrumentInput, actor: Actor) {
    const existing = await this.prisma.admin.diagnosticInstrument.findUnique({ where: { slug } });
    if (!existing) throw new NotFoundException('Diagnóstico não encontrado.');
    if (existing.builtIn && (dto.bandKind !== undefined || dto.active === false)) {
      throw new BadRequestException('Instrumento nativo: tipo de régua e ativação não podem ser alterados.');
    }
    const updated = await this.prisma.admin.diagnosticInstrument.update({
      where: { slug },
      data: {
        name: dto.name?.trim() || existing.name,
        bandKind: existing.builtIn ? existing.bandKind : (dto.bandKind ?? existing.bandKind),
        aggregation: dto.aggregation ?? existing.aggregation,
        description: dto.description === undefined ? existing.description : dto.description,
        active: existing.builtIn ? existing.active : (dto.active ?? existing.active),
      },
    });
    await this.audit.record({ action: 'instrument.update', actor, target: slug, meta: { name: updated.name } });
    return updated;
  }

  /** Remove um instrumento SEM versões; com versões, desativa (histórico preservado). */
  async remove(slug: string, actor: Actor) {
    const existing = await this.prisma.admin.diagnosticInstrument.findUnique({
      where: { slug },
      include: { _count: { select: { versions: true } } },
    });
    if (!existing) throw new NotFoundException('Diagnóstico não encontrado.');
    if (existing.builtIn) throw new BadRequestException('Instrumento nativo não pode ser removido.');
    if (existing._count.versions > 0) {
      await this.prisma.admin.diagnosticInstrument.update({ where: { slug }, data: { active: false } });
      await this.audit.record({ action: 'instrument.deactivate', actor, target: slug });
      return { ok: true as const, deactivated: true };
    }
    await this.prisma.admin.diagnosticInstrument.delete({ where: { slug } });
    await this.audit.record({ action: 'instrument.delete', actor, target: slug });
    return { ok: true as const, deactivated: false };
  }
}
