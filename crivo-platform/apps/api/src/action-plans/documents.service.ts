import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DOCUMENT_TYPE_LABEL,
  INVENTORY_RISK_LABEL,
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
const CNAE_RISK_LABEL: Record<string, string> = {
  BAIXO: 'Baixo', BAIXO_MEDIO: 'Baixo/Médio', MEDIO: 'Médio', MEDIO_ALTO: 'Médio/Alto', ALTO: 'Alto',
};

/** Seção "Base Técnica da Recomendação" — classificação CNAE/NR-1 que embasou o método. */
type CnaeDecisionRow = {
  cnpj: string | null;
  divisionCode: string | null;
  riskLevel: string | null;
  recommendedMethod: string | null;
  reviewedBy: string | null;
  createdAt: Date;
  decisionResult: unknown;
};
function buildBaseTecnicaSection(decision: CnaeDecisionRow | null): DocumentSection {
  if (!decision) {
    return {
      heading: 'Base Técnica da Recomendação',
      body:
        'Nenhuma classificação CNAE/NR-1 vinculada a esta empresa. Execute o Motor de Decisão ' +
        'CNAE/NR-1 (Super Admin) informando o CNPJ desta empresa para registrar a base técnica da recomendação.',
    };
  }
  const r = (decision.decisionResult ?? {}) as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(r[k]) ? (r[k] as string[]) : []);
  const data: string[][] = [
    ['CNPJ analisado', decision.cnpj ?? '—'],
    ['CNAE principal', `${(r.cnaePrincipalCodigo as string) ?? '—'} — ${(r.cnaePrincipalDescricao as string) ?? '—'}`],
    ['Divisão CNAE', `${decision.divisionCode ?? '—'} (${(r.divisionName as string) ?? '—'})`],
    ['Risco preliminar', decision.riskLevel ? CNAE_RISK_LABEL[decision.riskLevel] ?? decision.riskLevel : '—'],
    ['Método recomendado', METHOD_LABEL[decision.recommendedMethod ?? ''] ?? '—'],
    ['Documentos recomendados', arr('requiredDocuments').join(', ') || '—'],
    ['Evidências necessárias', arr('requiredEvidences').join('; ') || '—'],
    ['Responsável pela validação', decision.reviewedBy ?? 'Pendente de validação por especialista'],
    ['Data da análise', new Date(decision.createdAt).toLocaleString('pt-BR')],
  ];
  const criterios = arr('criteriaConsidered').join(' ');
  const alertas = arr('warnings').join(' ');
  const body =
    'Classificação preliminar técnica que embasou o método de diagnóstico e as saídas técnicas. ' +
    'Não substitui laudo ou parecer jurídico; sujeita à validação por especialista conforme a realidade operacional da empresa.' +
    (criterios ? `\n\nCritérios considerados: ${criterios}` : '') +
    (alertas ? `\n\nAlertas: ${alertas}` : '');
  return { heading: 'Base Técnica da Recomendação', body, table: { columns: ['Item', 'Valor'], data } };
}

/**
 * Geração de documentos proporcionais ao produto/saída técnica (Briefing §15).
 * Lê o contrato via owner (control plane) e os dados do plano/evidências via
 * forTenant (RLS). TODO documento técnico carrega a frase de responsabilidade.
 */
@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(tenantId: string) {
    // rls-allow: contract é control-plane (owner-only); self-scoped por organizationId = tenantId.
    let contract = await this.prisma.admin.contract.findFirst({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'desc' },
    });
    // Fallback (Tela 05 [5]): sem contrato próprio, a empresa herda o contrato do GRUPO.
    if (!contract) {
      const t = await this.prisma.admin.tenant.findFirst({
        where: { organizationId: tenantId },
        select: { groupId: true },
      });
      if (t?.groupId) {
        contract = await this.prisma.admin.contract.findFirst({
          where: { groupId: t.groupId },
          orderBy: { createdAt: 'desc' },
        });
      }
    }
    // rls-allow: organization é raiz do tenant (control-plane); leitura self-scoped por id=tenantId.
    const org = await this.prisma.admin.organization.findUnique({ where: { id: tenantId } });
    const plans = await this.prisma.forTenant(tenantId, (tx) =>
      tx.actionPlan.findMany({
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { evidences: true } } },
      }),
    );
    // Histórico de ciclos trimestrais (para o relatório de evolução, §15).
    const cycles = await this.prisma.forTenant(tenantId, (tx) =>
      tx.icdCycle.findMany({
        orderBy: [{ year: 'asc' }, { quarter: 'asc' }],
        include: { companyResult: true },
      }),
    );
    // Base Técnica da Recomendação: última decisão CNAE/NR-1 vinculada à empresa.
    // rls-allow: cnae_decision_history é control-plane (global); filtrado por companyId = tenantId.
    const cnaeDecision = await this.prisma.admin.cnaeDecisionHistory.findFirst({
      where: { companyId: tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return { contract, company: org?.name ?? 'Empresa', plans, cycles, cnaeDecision };
  }

  /** Documentos disponíveis conforme método + saída técnica do contrato. */
  async available(tenantId: string): Promise<DocumentDescriptor[]> {
    const { contract, plans, cycles } = await this.context(tenantId);
    const method = contract?.method ?? null;
    const output = contract?.technicalOutput ?? 'SEM_INTEGRACAO';
    const hasPlan = plans.length > 0;
    const hasValidated = plans.some((p) => p.validatedAt);
    const hasCycleHistory = cycles.some((c) => c.companyResult);

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
    // Relatório de evolução (§15): trajetória do ICD ao longo dos ciclos.
    add(
      'relatorio_evolucao',
      hasCycleHistory,
      hasCycleHistory ? undefined : 'Requer ao menos um ciclo trimestral de ICD consolidado',
    );
    return docs;
  }

  /** Monta o conteúdo estruturado do documento a partir dos dados reais. */
  async generate(tenantId: string, type: string): Promise<GeneratedDocument> {
    const { contract, company, plans, cycles, cnaeDecision } = await this.context(tenantId);
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
      const invItems = validatedPlan?.items ?? [];
      sections.unshift({
        heading: 'Inventário de fatores psicossociais (apoio ao PGR)',
        body:
          'Relação dos fatores psicossociais identificados, com fonte/origem, grupos expostos, ' +
          'medida de controle e classificação de risco — para integração ao GRO/PGR pelo responsável técnico. ' +
          'Derivado dos pontos do plano de ação.',
        table: {
          columns: ['Fator / ponto', 'Origem', 'Grupos expostos', 'Medida de controle', 'Risco', 'Responsável'],
          data: invItems.length
            ? invItems.map((i) => [
                i.point,
                i.origin ?? '—',
                i.exposedGroup ?? '—',
                i.action,
                i.riskLevel ? (INVENTORY_RISK_LABEL[i.riskLevel as keyof typeof INVENTORY_RISK_LABEL] ?? i.riskLevel) : '—',
                i.responsible ?? '—',
              ])
            : [['—', '—', '—', '—', '—', '—']],
        },
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
    if (type === 'relatorio_evolucao') {
      const rows = cycles
        .filter((c) => c.companyResult)
        .map((c) => {
          const r = c.companyResult!;
          return [
            `${c.year} · Q${c.quarter}`,
            r.suppressed ? 'Suprimido (<5)' : String(r.score ?? '—'),
            String(r.eligibleLeaders),
            new Date(r.computedAt).toLocaleDateString('pt-BR'),
          ];
        });
      sections.unshift({
        heading: 'Evolução do ICD (ciclos trimestrais)',
        body:
          'Trajetória do Índice de Coerência Decisória da liderança ao longo dos ciclos. ' +
          'Recortes com menos de 5 líderes elegíveis são suprimidos por confidencialidade (§11). ' +
          'O ICD é ferramenta de desenvolvimento e sustentação da liderança — não de avaliação individual.',
        table: {
          columns: ['Ciclo', 'ICD (0–100)', 'Líderes elegíveis', 'Consolidado em'],
          data: rows.length ? rows : [['—', '—', '—', '—']],
        },
      });
    }

    // #13 — Declaração de escopo: abertura formal dos dossiês AEP / AEP+PGR.
    if (type === 'dossie_aep' || type === 'dossie_aep_pgr') {
      sections.unshift({
        heading: 'Declaração de escopo',
        body:
          'Este documento registra os fatores de risco psicossociais relacionados ao trabalho ' +
          'identificados no ciclo avaliado, com a finalidade de subsidiar a Avaliação Ergonômica ' +
          'Preliminar (AEP)' +
          (output === 'AEP_PGR' ? ' e a integração ao GRO/PGR' : '') +
          '. Não substitui a AEP, o PGR, nem a validação da empresa ou do responsável técnico.',
      });
    }

    // Base Técnica da Recomendação (Motor CNAE/NR-1) — embasa o método e as saídas.
    sections.push(buildBaseTecnicaSection(cnaeDecision));

    // #13 — Conclusão e validação: fechamento formal com assinaturas (todos os documentos).
    sections.push({
      heading: 'Conclusão e validação',
      body:
        'A revisão, validação, assinatura e integração formal deste documento à AEP, ao GRO/PGR e ' +
        'às demais obrigações aplicáveis são de responsabilidade da empresa contratante e/ou do ' +
        'responsável técnico/designado.',
      table: {
        columns: ['Responsável', 'Nome', 'Cargo', 'Data', 'Validação'],
        data: [
          ['Empresa', '—', '—', '—', 'Validação eletrônica'],
          ['Responsável SST/designado', '—', '—', '—', 'Validação eletrônica'],
        ],
      },
    });

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
