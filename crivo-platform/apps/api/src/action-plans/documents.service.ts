import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  classifyTechnicalRisk,
  DOCUMENT_TYPE_LABEL,
  INVENTORY_RISK_LABEL,
  RESPONSIBILITY_NOTE,
  type DocumentDescriptor,
  type DocumentSection,
  type GeneratedDocument,
  type RiskLevel3,
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

const RISK3 = ['Baixa', 'Moderada', 'Alta'] as const;
const asRisk3 = (v: string | null | undefined): RiskLevel3 | null =>
  v && (RISK3 as readonly string[]).includes(v) ? (v as RiskLevel3) : null;

export type FactorItem = {
  point: string; origin: string | null; action: string; responsible: string | null;
  dueDate: Date | null; status: string; expectedEvidence: string | null;
  exposedGroup: string | null; severity: string | null; probability: string | null;
  riskLevel: string | null;
};

/**
 * Risco técnico do fator no dossiê (doc 09 §6). DERIVADO da matriz 3x3
 * Severidade x Probabilidade — nunca digitado. Sem os dois eixos, cai no
 * `riskLevel` legado (registros anteriores à matriz) e devolve `derived:false`.
 */
export function factorRisk(i: FactorItem): { label: string; derived: boolean; isHigh: boolean } {
  const sev = asRisk3(i.severity);
  const prob = asRisk3(i.probability);
  if (sev && prob) {
    const r = classifyTechnicalRisk(prob, sev);
    return { label: r, derived: true, isHigh: r === 'Alto' };
  }
  const legacyMap = INVENTORY_RISK_LABEL as Record<string, string | undefined>;
  const legacy = i.riskLevel ? (legacyMap[i.riskLevel] ?? i.riskLevel) : '—';
  return { label: legacy, derived: false, isHigh: /alto|cr[ií]tico/i.test(legacy) };
}

/**
 * Bloqueios de emissão do dossiê final (doc 09 §9). Regra de compliance,
 * validada no SERVIDOR: fator Alto exige responsável, prazo e evidência
 * esperada; e nenhuma ação pode estar sugerida ou em revisão.
 */
export function dossierBlockers(items: FactorItem[]): string[] {
  const out: string[] = [];
  const pendentes = items.filter((i) => i.status === 'SUGERIDA' || i.status === 'EM_REVISAO');
  if (pendentes.length) {
    out.push(
      `${pendentes.length} ação(ões) ainda sugerida(s) ou em revisão — o dossiê final exige plano aprovado.`,
    );
  }
  const altosIncompletos = items.filter((i) => {
    if (!factorRisk(i).isHigh) return false;
    return !i.responsible || !i.dueDate || !i.expectedEvidence;
  });
  if (altosIncompletos.length) {
    out.push(
      `${altosIncompletos.length} fator(es) de risco Alto sem responsável, prazo ou evidência esperada.`,
    );
  }
  return out;
}

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
      // rls-allow: tenant é control-plane; self-scoped por organizationId = tenantId.
      const t = await this.prisma.admin.tenant.findFirst({
        where: { organizationId: tenantId },
        select: { groupId: true },
      });
      if (t?.groupId) {
        // rls-allow: contract é control-plane (owner-only); herança do contrato do GRUPO via groupId.
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

    // Bloqueios de emissão do dossiê final (doc 09 §9), avaliados no servidor.
    // Como generate() revalida via available() (C2), isto também barra a rota direta.
    const validated = plans.find((p) => p.validatedAt) ?? plans[0];
    const blockers = validated ? dossierBlockers(validated.items as FactorItem[]) : [];
    const dossieOk = hasValidated && blockers.length === 0;
    const dossieReason = !hasValidated
      ? 'Requer plano de ação validado'
      : blockers.length
        ? blockers.join(' ')
        : undefined;
    const hasCycleHistory = cycles.some((c) => c.companyResult);

    const docs: DocumentDescriptor[] = [];
    const add = (type: string, available: boolean, reason?: string) =>
      docs.push({ type, title: DOCUMENT_TYPE_LABEL[type] ?? type, available, reason });

    if (method === 'INICIAL' || !contract) add('relatorio_preliminar', true);
    if (hasPlan) add('plano_acao', true);
    if (output === 'AEP' || output === 'AEP_PGR')
      add('dossie_aep', dossieOk, dossieReason);
    if (output === 'AEP_PGR') {
      add('dossie_aep_pgr', dossieOk, dossieReason);
      add('inventario_pgr', dossieOk, dossieReason);
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

    // GATE server-side: repetir a elegibilidade de available(). Sem isto, bastava
    // chamar generate() com um tipo válido para emitir documento que o contrato
    // não libera (ou sem plano validado) — brecha de autorização de saída.
    const eligible = await this.available(tenantId);
    const desc = eligible.find((d) => d.type === type);
    if (!desc || !desc.available) {
      throw new BadRequestException(
        desc?.reason ?? 'Este documento não está liberado para o contrato desta empresa.',
      );
    }

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

    // Matriz de fatores de risco psicossociais (doc 09 §6 / doc 10). O risco é
    // DERIVADO de Severidade x Probabilidade — separado do índice do
    // questionário, que orienta achados mas não classifica o dossiê.
    if (validatedPlan && validatedPlan.items.length) {
      const its = validatedPlan.items as FactorItem[];
      sections.push({
        heading: 'Matriz de fatores de risco psicossociais',
        table: {
          columns: ['ID', 'Fator', 'Fonte/circunstância', 'Grupo exposto', 'Sev.', 'Prob.', 'Risco', 'Ação'],
          data: its.map((i, n) => [
            `FP-${String(n + 1).padStart(3, '0')}`,
            i.point,
            i.origin ?? '—',
            i.exposedGroup ?? '—',
            asRisk3(i.severity) ?? '—',
            asRisk3(i.probability) ?? '—',
            factorRisk(i).label,
            i.action,
          ]),
        },
      });
      const semMatriz = its.filter((i) => !factorRisk(i).derived).length;
      if (semMatriz > 0) {
        sections.push({
          heading: 'Nota sobre a classificação de risco',
          body:
            `${semMatriz} fator(es) ainda usam a classificação manual anterior. A classificação ` +
            'técnica oficial do dossiê vem da matriz Severidade × Probabilidade (Baixo/Moderado/Alto); ' +
            'informe os dois eixos para que o risco seja derivado automaticamente.',
        });
      }
    }

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

      // REGRA DO PACOTE v3.1: só evidência APROVADA alimenta dossiê/relatório.
      // Antes entravam também REJEITADA/SUBSTITUIDA/pendente — o documento saía
      // apoiado em prova recusada (exposição em AEP/GRO/PGR).
      const allEvid = validatedPlan.items.flatMap((i) => i.evidences);
      const approved = allEvid.filter((e) => e.status === 'APROVADA');
      const excluded = allEvid.length - approved.length;
      if (approved.length) {
        sections.push({
          heading: 'Evidências validadas',
          table: {
            columns: ['Evidência', 'Tipo', 'Link/Referência', 'Validada em'],
            data: approved.map((e) => [
              e.title,
              e.kind,
              e.url ?? '—',
              e.reviewedAt ? fmt(e.reviewedAt) : '—',
            ]),
          },
        });
      }
      if (excluded > 0) {
        sections.push({
          heading: 'Evidências não incluídas',
          body:
            `${excluded} evidência(s) enviada(s) não entram neste documento por não estarem ` +
            'validadas (pendentes, rejeitadas ou substituídas). Somente evidência aprovada ' +
            'compõe a documentação técnica.',
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

  /**
   * Motor 4 (R-001) — EMITE a versão oficial: gera o documento (com todos os
   * gates de available()/§9 via generate) e o CONGELA como ReportEmission —
   * conteúdo + contexto do contrato + hash + numeração sequencial por tipo.
   * O preview (GET) continua dinâmico; a emissão nunca é reprocessada.
   */
  async emit(tenantId: string, type: string, actorEmail?: string) {
    const doc = await this.generate(tenantId, type); // reaplica elegibilidade + bloqueios
    // Hash de integridade sobre o CONTEÚDO estável — generatedAt muda a cada
    // geração e não pode participar, senão a idempotência nunca dispara.
    const { generatedAt: _volatile, ...stable } = doc;
    const contentHash = createHash('sha256').update(JSON.stringify(stable)).digest('hex');
    // rls-allow: contract é control-plane; snapshot do contexto no momento da emissão.
    const contract = await this.prisma.admin.contract.findFirst({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'desc' },
      select: { method: true, technicalOutput: true },
    });
    return this.prisma.forTenant(tenantId, async (tx) => {
      const last = await tx.reportEmission.findFirst({
        where: { type },
        orderBy: { emissionNumber: 'desc' },
        select: { emissionNumber: true, contentHash: true },
      });
      // Idempotência amigável: conteúdo idêntico ao da última emissão não gera
      // versão nova — devolve a existente (evita v2 igual à v1 por duplo clique).
      if (last && last.contentHash === contentHash) {
        const existing = await tx.reportEmission.findFirst({
          where: { type, emissionNumber: last.emissionNumber },
        });
        return { emission: existing!, reused: true as const };
      }
      const emission = await tx.reportEmission.create({
        data: {
          tenantId,
          type,
          title: doc.title,
          emissionNumber: (last?.emissionNumber ?? 0) + 1,
          method: contract?.method ?? null,
          technicalOutput: contract?.technicalOutput ?? null,
          content: doc as unknown as object,
          contentHash,
          generatedBy: actorEmail ?? null,
        },
      });
      return { emission, reused: false as const };
    });
  }

  /** Repositório do TENANT: emissões próprias (metadados; conteúdo sob demanda). */
  async listEmissions(tenantId: string) {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.reportEmission.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, type: true, title: true, emissionNumber: true, method: true,
          technicalOutput: true, contentHash: true, status: true, generatedBy: true,
          createdAt: true, reviewedBy: true, reviewedAt: true,
        },
      }),
    );
  }

  /** Conteúdo congelado de uma emissão do tenant (para reimprimir a versão exata). */
  async getEmission(tenantId: string, id: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const e = await tx.reportEmission.findUnique({ where: { id } });
      if (!e) throw new BadRequestException('Emissão não encontrada.');
      return e;
    });
  }
}

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString('pt-BR');
}
