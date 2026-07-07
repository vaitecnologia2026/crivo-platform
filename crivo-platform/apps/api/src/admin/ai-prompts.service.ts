import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import {
  AI_PROMPT_DEFAULTS,
  defaultPrompt,
  isAiPromptUseCase,
  type AiPromptUseCase,
} from './ai-prompt-defaults';

type Actor = { id: string; email: string };

export type AiPromptItem = {
  useCase: AiPromptUseCase;
  label: string;
  description: string;
  content: string; // configurado OU padrão
  isDefault: boolean; // true = ainda usando o padrão em código
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
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

  /** Lista todos os casos de uso, mesclando o padrão com o valor configurado. */
  async list(): Promise<AiPromptItem[]> {
    const rows = await this.prisma.admin.aiPrompt.findMany();
    const byUseCase = new Map(rows.map((r) => [r.useCase, r]));
    return AI_PROMPT_DEFAULTS.map((d) => {
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
      };
    });
  }

  /**
   * Prompt EFETIVO de um caso de uso — configurado no banco ou padrão em código.
   * Usado pelos consumidores de IA. Permissivo: qualquer falha cai no padrão.
   */
  async resolve(useCase: AiPromptUseCase): Promise<string> {
    try {
      const row = await this.prisma.admin.aiPrompt.findUnique({ where: { useCase } });
      return row?.content ?? defaultPrompt(useCase);
    } catch {
      return defaultPrompt(useCase);
    }
  }

  /** Salva (versiona) o prompt de um caso de uso. */
  async upsert(useCase: string, content: string, actor: Actor): Promise<AiPromptItem> {
    if (!isAiPromptUseCase(useCase)) throw new BadRequestException('Caso de uso de IA inválido.');
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

  /** Restaura o padrão em código (remove a customização). */
  async reset(useCase: string, actor: Actor): Promise<AiPromptItem> {
    if (!isAiPromptUseCase(useCase)) throw new BadRequestException('Caso de uso de IA inválido.');
    await this.prisma.admin.aiPrompt.deleteMany({ where: { useCase } });
    await this.audit.record({ action: 'ai.prompt.reset', actor, target: useCase, meta: {} });
    return this.itemOf(useCase);
  }

  private async itemOf(useCase: AiPromptUseCase): Promise<AiPromptItem> {
    const list = await this.list();
    return list.find((i) => i.useCase === useCase)!;
  }
}
