import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import {
  AI_PROMPT_DEFAULTS,
  defaultPrompt,
  diagnosticPromptDefault,
  isAiPromptUseCase,
  slugFromUseCase,
  type AiPromptUseCase,
} from './ai-prompt-defaults';

type Actor = { id: string; email: string };

export type AiPromptItem = {
  useCase: string; // estático (union) OU dinâmico diagnostic_<slug> (A5)
  label: string;
  description: string;
  content: string; // configurado OU padrão
  isDefault: boolean; // true = ainda usando o padrão em código
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
  /** A5 — true para casos gerados do catálogo de diagnósticos. */
  dynamic?: boolean;
};

/**
 * Central de prompts da IA (Caderno §10 · P0-c). Todos os prompts técnicos ficam
 * aqui, editáveis e versionados. Cada consumidor de IA resolve por `useCase`
 * (configurado no banco OU padrão em código). Super admin / control plane.
 */
@Injectable()
export class AiPromptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lista todos os casos de uso, mesclando o padrão com o valor configurado.
   *  A5: além dos estáticos, um caso DINÂMICO por diagnóstico ATIVO do Motor. */
  async list(): Promise<AiPromptItem[]> {
    const rows = await this.prisma.admin.aiPrompt.findMany();
    const byUseCase = new Map(rows.map((r) => [r.useCase, r]));
    const merge = (d: { useCase: string; label: string; description: string; content: string }, dynamic = false): AiPromptItem => {
      const row = byUseCase.get(d.useCase);
      return {
        useCase: d.useCase,
        label: d.label,
        description: d.description,
        content: row?.content ?? d.content,
        isDefault: !row,
        version: row?.version ?? 0,
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
        ...(dynamic ? { dynamic: true } : {}),
      };
    };
    const statics = AI_PROMPT_DEFAULTS.map((d) => merge(d));
    const instruments = await this.prisma.admin.diagnosticInstrument.findMany({
      where: { active: true },
      orderBy: [{ builtIn: 'desc' }, { createdAt: 'asc' }],
      select: { slug: true, name: true, description: true },
    });
    const dynamics = instruments.map((i) => merge(diagnosticPromptDefault(i), true));
    return [...statics, ...dynamics];
  }

  /**
   * A5 — valida caso de uso: estático da union OU dinâmico diagnostic_<slug>
   * com o slug EXISTENTE no catálogo (senão qualquer string viraria prompt).
   */
  private async assertValidUseCase(useCase: string): Promise<void> {
    if (isAiPromptUseCase(useCase)) return;
    const slug = slugFromUseCase(useCase);
    if (slug) {
      const inst = await this.prisma.admin.diagnosticInstrument.findUnique({ where: { slug } });
      // ATIVO obrigatório: instrumento inativo não aparece na Central (list()
      // só mescla ativos) — salvar aqui gravaria uma customização INVISÍVEL
      // que voltaria a valer sozinha ao reativar o instrumento.
      if (inst?.active) return;
      if (inst) throw new BadRequestException('Instrumento inativo no catálogo — reative-o antes de editar o prompt.');
    }
    throw new BadRequestException('Caso de uso de IA inválido.');
  }

  /**
   * Prompt EFETIVO de um caso de uso — configurado no banco ou padrão em código.
   * A5: casos dinâmicos (diagnostic_<slug>) caem no default GERADO do
   * instrumento. Permissivo: qualquer falha cai no padrão ('' se não existir).
   */
  async resolve(useCase: string): Promise<string> {
    try {
      const row = await this.prisma.admin.aiPrompt.findUnique({ where: { useCase } });
      if (row?.content) return row.content;
      const slug = slugFromUseCase(useCase);
      if (slug) {
        const inst = await this.prisma.admin.diagnosticInstrument.findUnique({
          where: { slug },
          select: { slug: true, name: true, description: true },
        });
        return inst ? diagnosticPromptDefault(inst).content : '';
      }
      return isAiPromptUseCase(useCase) ? defaultPrompt(useCase) : '';
    } catch {
      return isAiPromptUseCase(useCase) ? defaultPrompt(useCase) : '';
    }
  }

  /**
   * Rótulo da versão EFETIVA do prompt (p/ carimbar em documentos gerados —
   * ex.: PreliminaryReport.promptVersion). "padrão" = usando o default em código.
   */
  async resolveVersionLabel(useCase: string): Promise<string> {
    try {
      const row = await this.prisma.admin.aiPrompt.findUnique({ where: { useCase } });
      return row ? `v${row.version}` : 'padrão';
    } catch {
      return 'padrão';
    }
  }

  /** Salva (versiona) o prompt de um caso de uso (estático OU dinâmico A5). */
  async upsert(useCase: string, content: string, actor: Actor): Promise<AiPromptItem> {
    await this.assertValidUseCase(useCase);
    const text = content?.trim();
    if (!text || text.length < 20) throw new BadRequestException('O prompt precisa ter ao menos 20 caracteres.');

    const existing = await this.prisma.admin.aiPrompt.findUnique({ where: { useCase } });
    await this.prisma.admin.aiPrompt.upsert({
      where: { useCase },
      update: { content: text, version: (existing?.version ?? 0) + 1, updatedBy: actor.email },
      create: { useCase, content: text, version: 1, updatedBy: actor.email },
    });
    await this.audit.record({
      action: 'ai.prompt.update',
      actor,
      target: useCase,
      meta: { version: (existing?.version ?? 0) + 1, length: text.length },
    });
    return this.itemOf(useCase);
  }

  /** Restaura o padrão (remove a customização). A5: no reset aceitamos caso
   *  dinâmico mesmo de instrumento já removido — permite limpar órfãos. */
  async reset(useCase: string, actor: Actor): Promise<AiPromptItem> {
    if (!isAiPromptUseCase(useCase) && !slugFromUseCase(useCase)) {
      throw new BadRequestException('Caso de uso de IA inválido.');
    }
    await this.prisma.admin.aiPrompt.deleteMany({ where: { useCase } });
    await this.audit.record({ action: 'ai.prompt.reset', actor, target: useCase, meta: {} });
    return this.itemOf(useCase);
  }

  private async itemOf(useCase: string): Promise<AiPromptItem> {
    const list = await this.list();
    const found = list.find((i) => i.useCase === useCase);
    if (found) return found;
    // Reset de caso dinâmico órfão (instrumento removido/inativo): devolve o
    // estado "padrão" mínimo sem quebrar a resposta.
    return {
      useCase,
      label: useCase,
      description: 'Caso dinâmico sem instrumento ativo no catálogo.',
      content: '',
      isDefault: true,
      version: 0,
      updatedBy: null,
      updatedAt: null,
      dynamic: true,
    };
  }
}
