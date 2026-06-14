import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DOCUMENT_TYPE_LABEL,
  RESPONSIBILITY_NOTE,
  type DocumentDescriptor,
  type DocumentSection,
  type GeneratedDocument,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';

const METHOD_LABEL: Record<string, string> = {
  INICIAL: 'Diagnóstico Inicial',
  ESSENCIAL: 'Diagnóstico Essencial',
  ORGANIZACIONAL: 'Diagnóstico Organizacional',
};
const OUTPUT_LABEL: Record<string, string> = {
  SEM_INTEGRACAO: 'Sem integração formal',
  AEP: 'Apoio à AEP',
  AEP_PGR: 'Apoio à AEP + PGR',
};
const ACTION_LABEL: Record<string, string> = {
  SUGERIDA: 'Sugerida', EM_REVISAO: 'Em revisão', APROVADA: 'Aprovada',
  EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', REAVALIADA: 'Reavaliada',
};

/**
 * Geração de documentos proporcionais ao produto/saída técnica (Briefing §15).
 * Lê o contrato via owner (control plane) e os dados do plano/evidências via
 * forTenant (RLS). TODO documento técnico carrega a frase de responsabilidade.
 */
@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(tenantId: string) {
    const contract = await this.prisma.admin.contract.findFirst({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'desc' },
    });
    const org = await this.prisma.admin.organization.findUnique({ where: { id: tenantId } });
    const plans = await this.prisma.forTenant(tenantId, (tx) =>
      tx.actionPlan.findMany({
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { evidences: true } } },
      }),
    );
    return { contract, company: org?.name ?? 'Empresa', plans };
  }

  /** Documentos disponíveis conforme método + saída técnica do contrato. */
  async available(tenantId: string): Promise<DocumentDescriptor[]> {
    const { contract, plans } = await this.context(tenantId);
    const method = contract?.method ?? null;
    const output = contract?.technicalOutput ?? 'SEM_INTEGRACAO';
    const hasPlan = plans.length > 0;
    const hasValidated = plans.some((p) => p.validatedAt);

    const docs: DocumentDescriptor[] = [];
    const add = (type: string, available: boolean, reason?: string) =>
      docs.push({ type, title: DOCUMENT_TYPE_LABEL[type] ?? type, available, reason });

    if (method === 'INICIAL' || !contract) add('relatorio_preliminar', true);
    if (hasPlan) add('plano_acao', true);
    if (output === 'AEP' || output === 'AEP_PGR')
      add('dossie_aep', hasValidated, hasValidated ? undefined : 'Requer plano de ação validado');
    if (output === 'AEP_PGR') {
      add('dossie_aep_pgr', hasValidated, hasValidated ? undefined : 'Requer plano de ação validado');
      add('inventario_pgr', hasValidated, hasValidated ? undefined : 'Requer plano de ação validado');
    }
    if (method === 'ORGANIZACIONAL') add('relatorio_tecnico', true);
    add('relatorio_executivo', true);
    return docs;
  }

  /** Monta o conteúdo estruturado do documento a partir dos dados reais. */
  async generate(tenantId: string, type: string): Promise<GeneratedDocument> {
    const { contract, company, plans } = await this.context(tenantId);
    if (!DOCUMENT_TYPE_LABEL[type]) throw new BadRequestException('Tipo de documento inválido');

    const method = contract?.method ?? null;
    const output = contract?.technicalOutput ?? 'SEM_INTEGRACAO';
    const meta: GeneratedDocument['meta'] = [
      { label: 'Empresa', value: company },
      { label: 'Método', value: method ? METHOD_LABEL[method] : '—' },
      { label: 'Saída técnica', value: OUTPUT_LABEL[output] ?? output },
      { label: 'Responsável CRIVO', value: contract?.responsible ?? '—' },
    ];

    const sections: DocumentSection[] = [];

    // Plano de ação (tabela) — núcleo dos dossiês.
    const validatedPlan = plans.find((p) => p.validatedAt) ?? plans[0];
    if (validatedPlan) {
      sections.push({
        heading: `Plano de ação${validatedPlan.validatedAt ? ' (validado)' : ' (minuta)'}`,
        body: validatedPlan.validatedAt
          ? `Validado por ${validatedPlan.validatedBy ?? '—'} em ${fmt(validatedPlan.validatedAt)}.`
          : 'Plano ainda não validado pela empresa/responsável.',
        table: {
          columns: ['Ponto', 'Ação', 'Responsável', 'Prazo', 'Status', 'Evidência esperada'],
          data: validatedPlan.items.map((i) => [
            i.point,
            i.action,
            i.responsible ?? '—',
            i.dueDate ? fmt(i.dueDate) : '—',
            ACTION_LABEL[i.status] ?? i.status,
            i.expectedEvidence ?? '—',
          ]),
        },
      });

      const evid = validatedPlan.items.flatMap((i) =>
        i.evidences.map((e) => [e.title, e.kind, e.url ?? '—']),
      );
      if (evid.length) {
        sections.push({
          heading: 'Histórico de evidências',
          table: { columns: ['Evidência', 'Tipo', 'Link/Referência'], data: evid },
        });
      }
    } else {
      sections.push({ heading: 'Plano de ação', body: 'Nenhum plano de ação registrado.' });
    }

    // Seções específicas por tipo.
    if (type === 'inventario_pgr') {
      sections.unshift({
        heading: 'Inventário de fatores psicossociais (apoio ao PGR)',
        body:
          'Relação dos fatores psicossociais identificados, fontes/circunstâncias, grupos expostos, ' +
          'medidas de controle e classificação de risco — para integração ao GRO/PGR pelo responsável técnico.',
      });
    }
    if (type === 'relatorio_preliminar') {
      sections.unshift({
        heading: 'Leitura preliminar',
        body:
          'Resultado preliminar de maturidade e riscos invisíveis. Este documento NÃO substitui o ' +
          'CRIVO Diagnóstico™ completo nem caracteriza, por si só, a AEP ou o PGR.',
      });
    }
    if (type === 'relatorio_executivo') {
      sections.unshift({
        heading: 'Síntese executiva',
        body: 'Síntese para diretoria/RH: prioridades, riscos e decisões a partir do diagnóstico e do plano de ação.',
      });
    }

    return {
      type,
      title: DOCUMENT_TYPE_LABEL[type],
      subtitle: 'Documento de apoio técnico · CRIVO',
      company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }
}

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString('pt-BR');
}
