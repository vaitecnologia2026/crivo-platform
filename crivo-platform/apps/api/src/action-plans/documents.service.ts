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
import { resolveActiveMethodology } from '../admin/methodology.service';
import { getEngineConfig } from '../admin/engine-config';

type DiagnosticMethodLike = string | null;
type ReportTemplateSectionRow = { heading?: string; body?: string };

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
  // F2 — informados pela EMPRESA no Plano de Evolução (nunca inventados).
  areaProcess?: string | null; existingMeasure?: string | null; indicator?: string | null;
  // A4 — proveniência estruturada do fator (diagnóstico do Motor).
  sourceInstrumentSlug?: string | null;
  // A3 — evidências anexadas (status decide o bloqueio de dossiê p/ fator Alto).
  evidences?: { status: string }[];
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
  // A3 (residual): fator Alto exige evidência REAL e APROVADA no Motor de
  // Evidências — só o TEXTO "evidência esperada" não sustenta um dossiê final
  // (regra do pacote v3.1: somente evidência aprovada compõe a documentação).
  const altosSemEvidenciaAprovada = items.filter((i) => {
    if (!factorRisk(i).isHigh) return false;
    return !(i.evidences ?? []).some((e) => e.status === 'APROVADA');
  });
  if (altosSemEvidenciaAprovada.length) {
    // Mensagem ACIONÁVEL pelo cliente: anexar é dele; aprovar é da CRIVO.
    out.push(
      `${altosSemEvidenciaAprovada.length} fator(es) de risco Alto sem evidência aprovada — anexe a ` +
        'evidência na ação e aguarde a validação da equipe CRIVO (o status aparece em cada evidência).',
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

// ── Pacote Final de Templates (layouts oficiais) ─────────────────────────────

/** Códigos oficiais das dimensões do MAPA (ME1–ME6, confirmados pelo cliente). */
export const ME_CODE: Record<string, string> = {
  pressao_rotina: 'ME1',
  lideranca_sustentacao: 'ME2',
  cultura_comunicacao: 'ME3',
  fatores_psicossociais: 'ME4',
  governanca_plano: 'ME5',
  'dim-1': 'ME6', // Futuro do Trabalho e IA
};

/**
 * "Respostas válidas/adesão" do cabeçalho do Dossiê: "N de M (x%)". O campo de
 * empregados é texto livre ("1.200", "50 a 100") — só calculamos adesão quando
 * ele é UM número inequívoco (separador de milhar aceito) e coerente com o
 * volume de respostas; senão, mostramos só a contagem (nunca um % absurdo).
 */
function adhesionLabel(responses: number, employeesCount?: string | null): string {
  const raw = (employeesCount ?? '').trim().replace(/[.\s]/g, '');
  if (!/^\d+$/.test(raw)) return String(responses);
  const total = Number(raw);
  if (!total || total < responses) return String(responses);
  const pct = Math.round((responses / total) * 100);
  return `${responses} de ${total} (${pct}%)`;
}

type BandLike = { label: string; min: number; max: number };
/**
 * Classificação pela régua ativa — a MESMA régua vale p/ score geral e cada
 * dimensão. Scores fracionários podem cair no VÃO entre faixas inteiras
 * (ex.: 39,4 entre 0–39 e 40–59): classifica pela faixa imediatamente abaixo,
 * no mesmo espírito do fallback do motor canônico (nunca devolve "—" para um
 * score válido).
 */
function bandLabelOf(value: number, bands: BandLike[]): string {
  const exact = bands.find((b) => value >= b.min && value <= b.max);
  if (exact) return exact.label;
  const floor = [...bands].sort((a, b) => b.min - a.min).find((b) => value >= b.min);
  return floor?.label ?? bands[0]?.label ?? '—';
}

/**
 * F4 — ordem de severidade do risco técnico p/ comparar ciclos no TPL-003.
 * Cobre a matriz oficial (Baixo/Moderado/Alto) e rótulos legados; null =
 * rótulo desconhecido (a comparação vira "indisponível", nunca chuta).
 */
function riskRank(label: string | null | undefined): number | null {
  const l = (label ?? '').toLowerCase();
  if (!l || l === '—') return null;
  if (l.includes('baixo')) return 0;
  if (l.includes('moderado') || l.includes('médio') || l.includes('medio')) return 1;
  if (l.includes('crítico') || l.includes('critico')) return 3;
  if (l.includes('alto')) return 2;
  return null;
}

/** F4 — RESULTADO do comparativo fator a fator (TPL-003 §3), derivado dos ranks. */
function evolutionResult(prev: string | null, cur: string | null): string {
  if (prev == null && cur != null) return 'Novo neste ciclo';
  if (prev != null && cur == null) return 'Fora do plano no ciclo atual';
  const a = riskRank(prev);
  const b = riskRank(cur);
  if (a == null || b == null) return 'Comparação indisponível';
  if (b < a) return 'Risco reduzido';
  if (b > a) return 'Risco agravado';
  return 'Estável';
}

/**
 * F3 — quebra o texto aprovado de "Leitura dos principais sinais" em leituras
 * por código (linhas no formato "ME1 — leitura."). Linhas que NÃO casam com um
 * código listado (prosa livre, ou código fora de forças/atenções vigentes)
 * voltam como `prose` e entram no corpo da seção — NENHUMA linha aprovada se
 * perde, mesmo em casamento parcial.
 */
function signalReadings(
  text: string | undefined,
  codes: string[],
): { byCode: Record<string, string>; prose: string | null } {
  if (!text) return { byCode: {}, prose: null };
  const byCode: Record<string, string> = {};
  const leftovers: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^([A-Za-z]{2}\d+)\s*[—:·–-]\s*(.+)$/);
    const code = m?.[1].toUpperCase();
    if (m && code && codes.includes(code) && !byCode[code]) byCode[code] = m[2].trim();
    else leftovers.push(trimmed);
  }
  return { byCode, prose: leftovers.length ? leftovers.join('\n') : null };
}

/**
 * Bloco de assinatura EM BRANCO (decisão do cliente 27/07): o PDF sai com os
 * campos para assinar FORA do sistema — sem login do RT, sem assinatura na
 * CRIVO, sem upload obrigatório. Registro profissional quando aplicável.
 */
function signatureSection(conclusionBody: string): DocumentSection {
  return {
    heading: 'Conclusão e validação',
    body: conclusionBody,
    table: {
      columns: ['Responsável', 'Nome', 'Cargo', 'Registro profissional', 'Data', 'Assinatura'],
      data: [
        ['Empresa', '', '', '', '', ''],
        ['Responsável técnico/designado', '', '', '', '', ''],
      ],
    },
  };
}

/**
 * Controle documental (todos os TPL). Na PRÉ-VISUALIZAÇÃO sai como rascunho;
 * na emissão oficial, emit() substitui esta seção por status "Documento
 * emitido" + versão + data + hash reais (após calcular o hash de integridade).
 */
function docControlSection(): DocumentSection {
  return {
    heading: 'Controle documental',
    rows: [
      { label: 'Status do documento', value: 'Rascunho (pré-visualização)' },
      { label: 'Versão do documento', value: 'Atribuída na emissão oficial' },
      { label: 'Data de emissão', value: '—' },
      { label: 'Validação', value: 'Assinatura fora do sistema (empresa e responsável técnico)' },
      { label: 'Hash/Identificador', value: 'Atribuído na emissão oficial' },
    ],
  };
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
        // Desempate por id: sem ele, dois planos criados no mesmo milissegundo
        // podem sair em ordem diferente a cada leitura — e `plans[0]` é quem
        // alimenta o documento. Mesmo critério já usado no histórico de alterações.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          items: {
            // Os IDs do dossiê (FP-001, A-001, R-001) são POSICIONAIS neste
            // array e entram no contentHash da emissão. Sem ordenação fixa, o
            // MESMO dado geraria numeração e hash diferentes a cada emissão,
            // quebrando a idempotência ("o conteúdo não mudou desde a v1").
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            include: { evidences: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
          },
        },
      }),
    );
    // Base Técnica da Recomendação: última decisão CNAE/NR-1 vinculada à empresa.
    // rls-allow: cnae_decision_history é control-plane (global); filtrado por companyId = tenantId.
    const cnaeDecision = await this.prisma.admin.cnaeDecisionHistory.findFirst({
      where: { companyId: tenantId },
      orderBy: { createdAt: 'desc' },
    });
    // Método EFETIVO: a SOLUÇÃO contratada manda; `contract.method` é exceção e
    // só vale se a solução não define o seu. Antes o override do contrato tinha
    // precedência e ficava preso ao trocar a solução (documentos saíam com o
    // método antigo). Mesma regra do portal (/me/diagnostic-context).
    const product = contract?.productId
      // rls-allow: Product é catálogo GLOBAL (sem tenantId) — control-plane.
      ? await this.prisma.admin.product.findUnique({
          where: { id: contract.productId },
          select: { method: true },
        })
      : null;
    const method = (product?.method ?? contract?.method ?? null) as DiagnosticMethodLike;
    return { contract, method, org, company: org?.name ?? 'Empresa', plans, cnaeDecision };
  }

  /**
   * Fonte do MAPA Executivo CRIVO™ (TPL-001) para a empresa: (1) o lead
   * convertido que respondeu o MAPA na LP/CRM; (2) fallback: agregado das
   * respostas do instrumento PRE_DIAGNOSTIC aplicadas pela própria empresa.
   * Template único nos dois canais — muda só a origem do dado (decisão 27/07).
   */
  private async mapaSource(tenantId: string) {
    const active = await resolveActiveMethodology(this.prisma, 'PRE_DIAGNOSTIC');
    const dims = active ? active.config.dimensions.filter((d) => !d.parentSlug) : [];
    const bands = (active?.config.bands ?? []) as BandLike[];
    // rls-allow: tenant/platform_lead são control-plane; leitura self-scoped pela empresa.
    const tenant = await this.prisma.admin.tenant.findFirst({
      where: { organizationId: tenantId },
      select: { id: true },
    });
    if (tenant) {
      // PlatformLead é control-plane (CRM de leads, sem tenantId); aqui já vem
      // filtrado pelo tenant convertido, resolvido logo acima.
      // rls-allow: tabela de control-plane, sem coluna de tenant.
      const leads = await this.prisma.admin.platformLead.findMany({
        where: { convertedTenantId: tenant.id },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      });
      const lead = leads.find((l) => l.diagnosticResult && l.diagnosticScore != null);
      if (lead) {
        const r = lead.diagnosticResult as {
          score: number;
          level?: string;
          levelLabel?: string;
          byDimension?: Record<string, number>;
          dimensionLabels?: Record<string, string>;
        };
        return {
          kind: 'lead' as const,
          respondentName: lead.name,
          respondentRole: lead.company ? `Contato — ${lead.company}` : '—',
          concludedAt: lead.createdAt,
          score: r.score,
          byDimension: r.byDimension ?? {},
          dimensionLabels: r.dimensionLabels ?? {},
          dims,
          bands,
        };
      }
    }
    // Fallback: a empresa aplicou o MAPA logada (respostas do PRE_DIAGNOSTIC).
    const agg = await this.instrumentSummary(tenantId, 'PRE_DIAGNOSTIC');
    if (agg && !agg.suppressed) {
      const byDimension: Record<string, number> = {};
      const dimensionLabels: Record<string, string> = {};
      for (const d of agg.byDimension) {
        byDimension[d.slug] = d.value;
        dimensionLabels[d.slug] = d.label;
      }
      return {
        kind: 'aggregate' as const,
        respondentName: 'Aplicação coletiva',
        respondentRole: `${agg.totalRespondents} respondente(s)`,
        concludedAt: agg.lastResponseAt,
        score: agg.score,
        byDimension,
        dimensionLabels,
        dims,
        bands,
      };
    }
    return null;
  }

  /**
   * Documentos disponíveis conforme método + saída técnica do contrato.
   *
   * `ctx` opcional: quem já leu o contexto passa a MESMA leitura. Sem isso,
   * generate() lia o banco duas vezes (uma para montar o conteúdo, outra aqui
   * para o portão) — e o documento podia ser montado de um retrato enquanto o
   * portão aprovava outro. Chamada sem ctx (rota /documents) segue lendo.
   */
  async available(
    tenantId: string,
    ctx?: Awaited<ReturnType<DocumentsService['context']>>,
  ): Promise<DocumentDescriptor[]> {
    const { contract, method, plans } = ctx ?? (await this.context(tenantId));
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
    const docs: DocumentDescriptor[] = [];
    const add = (type: string, available: boolean, reason?: string) =>
      docs.push({ type, title: DOCUMENT_TYPE_LABEL[type] ?? type, available, reason });

    if (method === 'INICIAL' || !contract) add('relatorio_preliminar', true);
    // TPL-001 — Relatório Executivo do MAPA CRIVO™: evento de geração é "MAPA
    // concluído" (Pacote §1) — precisa existir a fonte do MAPA (lead convertido
    // ou aplicação do PRE_DIAGNOSTIC pela empresa).
    const mapa = await this.mapaSource(tenantId);
    add(
      'relatorio_executivo',
      !!mapa,
      mapa ? undefined : 'Requer o MAPA Executivo CRIVO™ concluído (diagnóstico inicial respondido)',
    );
    // TPL-004 — Extrato do Plano de Ação Preventivo: quando há plano.
    if (hasPlan) add('plano_acao', true);
    // TPL-002 — Dossiê Técnico (template ÚNICO, Pacote §3): sai com saída técnica
    // AEP ou AEP+PGR; os blocos por método/saída são resolvidos na geração.
    if (output === 'AEP' || output === 'AEP_PGR') add('dossie_tecnico', dossieOk, dossieReason);
    if (method === 'ORGANIZACIONAL') add('relatorio_tecnico', true);
    // TPL-003 — Relatório de Evolução e Efetividade: compara os DOIS últimos
    // CICLOS FORMAIS encerrados (definição do cliente 27/07: ciclo = aplicação
    // aberta e encerrada; atualizar ação/prazo NÃO cria ciclo). A comparação é
    // fator a fator sobre os SNAPSHOTS congelados no encerramento (F4).
    const comparable = await this.comparableCycles(tenantId);
    add(
      'relatorio_evolucao',
      comparable.ok,
      comparable.ok ? undefined : comparable.reason,
    );

    // Relatórios cadastrados no Motor 4 e VINCULADOS a um diagnóstico do Motor
    // de Diagnósticos (cultura, NR-1, IA, governança…). Ficam disponíveis quando
    // a empresa aplicou aquele diagnóstico e o volume permite divulgar (supressão).
    for (const t of await this.reportTemplates()) {
      const agg = await this.instrumentSummary(tenantId, t.instrumentSlug);
      const ok = !!agg && !agg.suppressed;
      docs.push({
        type: `tpl:${t.key}`,
        title: t.name,
        available: ok,
        reason: ok
          ? undefined
          : !agg || agg.totalRespondents === 0
            ? `Requer respostas do diagnóstico "${t.instrumentName}"`
            : `Requer ao menos ${agg.minRespondents} respostas no diagnóstico "${t.instrumentName}" (hoje: ${agg.totalRespondents}) — regra de anonimato`,
      });
    }
    return docs;
  }

  /**
   * Documento de um MODELO cadastrado: junta o texto fixo do modelo com o
   * RESULTADO REAL do diagnóstico vinculado (agregado, com supressão) e, se
   * marcado, as ações do Plano de Evolução. É o que liga o Motor 4 ao Motor de
   * Diagnósticos: trocar a metodologia muda o conteúdo do relatório.
   */
  private async generateFromTemplate(
    tenantId: string,
    key: string,
    ctx: {
      company: string;
      contract: { technicalOutput?: string | null; responsible?: string | null } | null;
      method: DiagnosticMethodLike;
      plans: { title: string; validatedAt: Date | null; items: FactorItem[] }[];
    },
  ): Promise<GeneratedDocument> {
    // rls-allow: report_templates é control-plane (catálogo global, owner-only).
    const tpl = await this.prisma.admin.reportTemplate.findUnique({
      where: { key },
      include: { instrument: { select: { name: true, slug: true } } },
    });
    if (!tpl) throw new BadRequestException('Modelo de relatório não encontrado.');

    const agg = await this.instrumentSummary(tenantId, tpl.instrumentSlug);
    if (!agg || agg.suppressed) {
      throw new BadRequestException(
        `Sem respostas suficientes no diagnóstico "${tpl.instrument.name}" para emitir este relatório.`,
      );
    }

    const output = ctx.contract?.technicalOutput ?? 'SEM_INTEGRACAO';
    const meta: GeneratedDocument['meta'] = [
      { label: 'Empresa', value: ctx.company },
      { label: 'Diagnóstico aplicado', value: tpl.instrument.name },
      { label: 'Método', value: ctx.method ? METHOD_LABEL[ctx.method] ?? ctx.method : '—' },
      { label: 'Saída técnica', value: OUTPUT_LABEL[output] ?? output },
      { label: 'Respondentes', value: String(agg.totalRespondents) },
      { label: 'Responsável CRIVO', value: ctx.contract?.responsible ?? '—' },
    ];

    const sections: DocumentSection[] = [];

    // 1) Texto fixo do modelo (contexto, metodologia, limites) — o que a CRIVO
    //    cadastrou no Super Admin.
    for (const s of (tpl.sections as ReportTemplateSectionRow[] | null) ?? []) {
      if (s?.heading || s?.body) {
        sections.push({ heading: s.heading || 'Contexto', body: s.body || '' });
      }
    }

    // 2) Resultado do diagnóstico (score + faixa) direto do motor.
    if (tpl.includeResults) {
      sections.push({
        heading: 'Resultado do diagnóstico',
        body:
          `Resultado agregado de "${tpl.instrument.name}" com base em ${agg.totalRespondents} ` +
          `respondente(s)${agg.sectors ? ` em ${agg.sectors} setor(es)` : ''}. ` +
          'Resultado coletivo — nenhuma resposta individual é exibida ou identificável.',
        rows: [
          { label: 'Índice do diagnóstico (0–100)', value: String(agg.score) },
          { label: 'Faixa', value: agg.levelLabel },
          { label: 'Respondentes', value: String(agg.totalRespondents) },
          {
            label: 'Última resposta',
            value: agg.lastResponseAt ? fmt(agg.lastResponseAt) : '—',
          },
        ],
      });
    }

    // 3) Dimensões do instrumento (a estrutura publicada na metodologia ativa).
    if (tpl.includeDimensions && agg.byDimension.length) {
      sections.push({
        heading: 'Resultado por dimensão',
        body: 'Média por dimensão da versão da metodologia ativa no período.',
        table: {
          columns: ['Dimensão', 'Índice (0–100)'],
          data: agg.byDimension.map((d) => [d.label, String(d.value)]),
        },
      });
    }

    // 4) Ações do Plano de Evolução (quando o modelo pede).
    if (tpl.includePlan) {
      const plan = ctx.plans.find((p) => p.validatedAt) ?? ctx.plans[0];
      const items = plan?.items ?? [];
      sections.push({
        heading: 'Plano de Evolução vinculado',
        body: plan
          ? `Ações registradas em "${plan.title}"${plan.validatedAt ? ' (plano validado)' : ' (plano ainda não validado)'}.`
          : 'Nenhum plano de evolução registrado para esta empresa até o momento.',
        table: items.length
          ? {
              columns: ['Ponto de atenção', 'Ação', 'Responsável', 'Prazo', 'Risco', 'Status'],
              data: items.map((i) => [
                i.point,
                i.action,
                i.responsible ?? '—',
                i.dueDate ? fmt(i.dueDate) : '—',
                factorRisk(i).label,
                ACTION_LABEL[i.status] ?? i.status,
              ]),
            }
          : undefined,
      });
    }

    sections.push(
      signatureSection(
        'A revisão, validação e integração formal deste relatório às obrigações aplicáveis são de ' +
          'responsabilidade da empresa contratante e/ou do responsável técnico/designado.',
      ),
    );
    sections.push(docControlSection());

    return {
      type: `tpl:${tpl.key}`,
      title: tpl.name,
      subtitle: tpl.description || `Relatório vinculado ao diagnóstico ${tpl.instrument.name}`,
      company: ctx.company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  /**
   * Adesão por setor/área/turno com SUPRESSÃO por volume mínimo (Bloqueio §5:
   * "não exibir recorte com volume inferior ao mínimo de confidencialidade").
   * Volume = número de respondentes do recorte; recortes abaixo do mínimo têm o
   * número ocultado. Fonte: respostas psicossociais (o dossiê é psicossocial).
   */
  private async sectorAdhesion(tenantId: string) {
    const minRespondents = (await getEngineConfig(this.prisma)).minRespondents;
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.psychosocialResponse.findMany({ select: { sector: true } });
      const bySector = new Map<string, number>();
      for (const r of rows) {
        const k = r.sector?.trim() || 'Não informado';
        bySector.set(k, (bySector.get(k) ?? 0) + 1);
      }
      const sectors = [...bySector.entries()]
        .map(([sector, respondents]) => ({
          sector,
          respondents,
          suppressed: respondents < minRespondents,
        }))
        .sort((a, b) => b.respondents - a.respondents);
      return { minRespondents, total: rows.length, sectors };
    });
  }

  /** Modelos ATIVOS do catálogo (control-plane). */
  private async reportTemplates() {
    // rls-allow: report_templates é control-plane (catálogo global, owner-only).
    const rows = await this.prisma.admin.reportTemplate.findMany({
      where: { active: true, instrument: { active: true } },
      orderBy: { name: 'asc' },
      include: { instrument: { select: { name: true } } },
    });
    return rows.map(({ instrument, ...t }) => ({ ...t, instrumentName: instrument.name }));
  }

  /**
   * Agregado do instrumento para a empresa — MESMA regra da tela de resultados:
   * média das respostas, faixa da metodologia ativa e supressão por volume
   * mínimo (Configuração do Motor). Nunca expõe resposta individual.
   */
  private async instrumentSummary(tenantId: string, instrumentSlug: string) {
    const minRespondents = (await getEngineConfig(this.prisma)).minRespondents;
    const active = await resolveActiveMethodology(this.prisma, instrumentSlug);
    const dims = active ? active.config.dimensions.filter((d) => !d.parentSlug) : [];
    const bands = active?.config.bands ?? [];
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.diagnosticResponse.findMany({
        where: { instrumentSlug },
        select: { score: true, byDimension: true, sector: true, submittedAt: true },
      });
      const total = rows.length;
      if (total === 0 || total < minRespondents) {
        return { suppressed: true as const, totalRespondents: total, minRespondents };
      }
      const score = Math.round((rows.reduce((s, r) => s + r.score, 0) / total) * 10) / 10;
      const byDimension = dims.map((d) => {
        const vals = rows.map((r) => Number((r.byDimension as Record<string, number>)?.[d.slug] ?? 0));
        return {
          slug: d.slug,
          label: d.label,
          value: Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 10) / 10,
        };
      });
      const band = bands.find((b) => score >= b.min && score <= b.max);
      const sectors = new Set(rows.map((r) => r.sector).filter(Boolean));
      const last = rows.reduce<Date | null>(
        (acc, r) => (!acc || r.submittedAt > acc ? r.submittedAt : acc),
        null,
      );
      return {
        suppressed: false as const,
        totalRespondents: total,
        minRespondents,
        score,
        levelLabel: band?.label ?? '—',
        byDimension,
        sectors: sectors.size,
        lastResponseAt: last,
      };
    });
  }

  /**
   * Agregado do questionário PSICOSSOCIAL da empresa (tabela própria, não a de
   * instrumentos dinâmicos): score/dimensões pela metodologia ATIVA, período
   * (1ª e última resposta) e supressão pelo mínimo de confidencialidade.
   */
  private async psychosocialSummary(tenantId: string, range?: { from: Date; to: Date }) {
    const minRespondents = (await getEngineConfig(this.prisma)).minRespondents;
    const active = await resolveActiveMethodology(this.prisma, 'PSYCHOSOCIAL');
    const dims = active ? active.config.dimensions.filter((d) => !d.parentSlug) : [];
    const bands = (active?.config.bands ?? []) as BandLike[];
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.psychosocialResponse.findMany({
        // F4: com `range`, só as respostas DA JANELA DO CICLO entram no
        // snapshot congelado — a aplicação formal é o período aberto/encerrado.
        where: range ? { submittedAt: { gte: range.from, lte: range.to } } : undefined,
        select: { sector: true, score: true, byDimension: true, submittedAt: true },
      });
      const total = rows.length;
      const dates = rows.map((r) => r.submittedAt).sort((a, b) => a.getTime() - b.getTime());
      const period =
        dates.length > 0 ? `${fmt(dates[0])} a ${fmt(dates[dates.length - 1])}` : '—';
      if (total < minRespondents) {
        return { suppressed: true as const, totalRespondents: total, minRespondents, period };
      }
      const score = Math.round(rows.reduce((s, r) => s + r.score, 0) / total);
      const byDimension = dims.map((d) => {
        const vals = rows.map((r) => Number((r.byDimension as Record<string, number>)?.[d.slug] ?? 0));
        return {
          slug: d.slug,
          label: d.label,
          value: Math.round(vals.reduce((s, x) => s + x, 0) / vals.length),
        };
      });
      const sectorsList = [...new Set(rows.map((r) => r.sector?.trim()).filter(Boolean))] as string[];
      return {
        suppressed: false as const,
        totalRespondents: total,
        minRespondents,
        period,
        score,
        levelLabel: bandLabelOf(score, bands),
        byDimension,
        bands,
        sectorsList,
      };
    });
  }

  /**
   * F3 — TEXTOS APROVADOS do documento (decisão 1-A): a IA rascunha, a equipe
   * CRIVO aprova no Super Admin, e SÓ o texto aprovado entra aqui. Retorna o
   * mapa campo → texto aprovado (campos sem aprovação ficam de fora).
   */
  private async approvedTextsOf(tenantId: string, docType: string): Promise<Record<string, string>> {
    // rls-allow: approved_texts é control-plane (fila de aprovação, owner-only).
    const rows = await this.prisma.admin.approvedText.findMany({
      where: { tenantId, docType },
      select: { field: true, approvedContent: true },
    });
    const out: Record<string, string> = {};
    for (const r of rows) {
      const text = r.approvedContent?.trim();
      if (text) out[r.field] = text;
    }
    return out;
  }

  // ── F4 · Ciclos formais de diagnóstico (snapshot p/ TPL-003) ───────────────

  /**
   * SNAPSHOT congelado no ENCERRAMENTO do ciclo: fatores do plano com risco
   * derivado + evidências + agregado psicossocial DA JANELA do ciclo. É a fonte
   * imutável do comparativo do TPL-003 — nunca recalculada depois.
   */
  async cycleSnapshot(tenantId: string, from: Date, to: Date) {
    const { method, plans } = await this.context(tenantId);
    const plan = plans.find((p) => p.validatedAt) ?? plans[0];
    const items = (plan?.items ?? []) as (Omit<FactorItem, 'evidences'> & {
      evidences: { title: string; status: string }[];
    })[];
    const factors = items.map((i) => {
      const risk = factorRisk(i);
      return {
        point: i.point,
        action: i.action,
        risk: risk.label,
        riskDerived: risk.derived,
        status: i.status,
        areaProcess: i.areaProcess ?? null,
        indicator: i.indicator ?? null,
        // A4 — proveniência congelada junto com o fator (auditoria/TPL-003).
        origin: i.origin ?? null,
        sourceInstrumentSlug: i.sourceInstrumentSlug ?? null,
        evidences: i.evidences.map((e) => ({ title: e.title, status: e.status })),
      };
    });
    const psy = await this.psychosocialSummary(tenantId, { from, to });
    return {
      method: method ?? null,
      methodologyVersion: await this.activeVersionLabel('PSYCHOSOCIAL'),
      snapshot: {
        planTitle: plan?.title ?? null,
        planValidatedAt: plan?.validatedAt ? new Date(plan.validatedAt).toISOString() : null,
        factors,
        psychosocial: {
          totalRespondents: psy.totalRespondents,
          suppressed: psy.suppressed,
          score: psy.suppressed ? null : psy.score,
          levelLabel: psy.suppressed ? null : psy.levelLabel,
        },
      },
    };
  }

  /** Os DOIS últimos ciclos ENCERRADOS com fatores congelados (base do TPL-003). */
  private async comparableCycles(tenantId: string) {
    const closed = await this.prisma.forTenant(tenantId, (tx) =>
      tx.diagnosticCycle.findMany({
        where: { status: 'ENCERRADO' },
        orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
        // Snapshots são JSONB inteiros — limitar a janela recente basta (o
        // comparativo usa só os 2 últimos com fatores) e evita carregar anos.
        take: 24,
      }),
    );
    type Snap = { factors?: unknown[] };
    const withFactors = closed.filter((c) => ((c.snapshot as Snap | null)?.factors ?? []).length > 0);
    if (withFactors.length < 2) {
      const semFatores = closed.length - withFactors.length;
      return {
        ok: false as const,
        reason:
          `Requer dois ciclos formais de diagnóstico encerrados com fatores registrados — hoje: ` +
          `${closed.length} encerrado(s)${semFatores > 0 ? ` (${semFatores} sem fatores no plano)` : ''}. ` +
          'Abra e encerre ciclos em Plano de Evolução · Ciclos de diagnóstico.',
      };
    }
    return { ok: true as const, current: withFactors[0], previous: withFactors[1] };
  }

  /** Número da versão metodológica ATIVA de um instrumento (rótulo "v N"). */
  private async activeVersionLabel(instrument: string): Promise<string> {
    // rls-allow: methodology_versions é control-plane (catálogo global).
    const v = await this.prisma.admin.methodologyVersion.findFirst({
      where: { instrument, status: 'ACTIVE' },
      select: { version: true },
    });
    return v ? `v${v.version}` : '—';
  }

  // ── TPL-001 · Relatório Executivo do MAPA CRIVO™ (layout oficial) ──────────
  private async generateMapaExecutivo(
    tenantId: string,
    ctx: { company: string; org: { taxId: string | null } | null; cnaeDecision: CnaeDecisionRow | null },
  ): Promise<GeneratedDocument> {
    const mapa = await this.mapaSource(tenantId);
    if (!mapa) throw new BadRequestException('Requer o MAPA Executivo CRIVO™ concluído.');
    const approved = await this.approvedTextsOf(tenantId, 'relatorio_executivo');

    const meta: GeneratedDocument['meta'] = [
      { label: 'Empresa', value: ctx.company },
      { label: 'CNPJ', value: ctx.org?.taxId ?? '—' },
      { label: 'Respondente', value: mapa.respondentName },
      { label: 'Cargo/Função', value: mapa.respondentRole },
      { label: 'Data da conclusão', value: mapa.concludedAt ? fmt(mapa.concludedAt) : '—' },
      { label: 'Versão metodológica', value: await this.activeVersionLabel('PRE_DIAGNOSTIC') },
    ];

    // Dimensões na ordem da metodologia ativa, com código oficial ME1–ME6.
    const dimRows = mapa.dims.map((d, i) => {
      const value = mapa.byDimension[d.slug];
      const name = mapa.dimensionLabels[d.slug] ?? d.label;
      return {
        code: ME_CODE[d.slug] ?? `ME${i + 1}`,
        name,
        value: typeof value === 'number' ? value : null,
      };
    });
    // Fallback: o snapshot do respondente pode ter dimensões que a metodologia
    // ATIVA não tem mais (republicação com slugs novos, ou sem versão ativa).
    // Os valores gravados NÃO são descartados — entram com o rótulo do snapshot.
    const knownSlugs = new Set(mapa.dims.map((d) => d.slug));
    for (const slug of Object.keys(mapa.byDimension)) {
      if (knownSlugs.has(slug)) continue;
      const value = mapa.byDimension[slug];
      if (typeof value !== 'number') continue;
      dimRows.push({
        code: ME_CODE[slug] ?? `ME${dimRows.length + 1}`,
        name: mapa.dimensionLabels[slug] ?? slug,
        value,
      });
    }
    const scored = dimRows.filter((d): d is typeof d & { value: number } => d.value != null);
    const sorted = [...scored].sort((a, b) => b.value - a.value);
    // Forças e Atenções são conjuntos DISJUNTOS: as atenções saem do restante
    // (com ≤2 dimensões pontuadas não há "atenção" separada — nada duplica).
    const forces = sorted.slice(0, 2);
    const attentions = sorted.slice(2).slice(-2).reverse();

    // F3 — leitura dos sinais aprovada, quebrada por código oficial (ME1–ME6).
    const sinais = signalReadings(
      approved['sinais_leitura'],
      [...forces, ...attentions].map((d) => d.code),
    );

    const sections: DocumentSection[] = [
      {
        heading: 'Documento executivo preliminar',
        body:
          'O MAPA Executivo CRIVO™ é uma leitura preliminar executiva. Não é diagnóstico técnico, ' +
          'AEP, PGR, dossiê NR-1, avaliação clínica ou evidência normativa isolada.',
      },
      {
        heading: '1. Síntese executiva',
        body:
          approved['sintese_executiva'] ??
          'Síntese executiva pendente de aprovação pela equipe CRIVO (a IA da Plataforma rascunha, ' +
            'a equipe revisa e aprova no Super Admin). A emissão oficial inclui a síntese aprovada.',
      },
      {
        heading: '2. Resultado geral',
        rows: [
          { label: 'Score geral', value: String(mapa.score) },
          { label: 'Classificação', value: bandLabelOf(mapa.score, mapa.bands) },
        ],
      },
      {
        heading: '3. Dimensões oficiais',
        table: {
          columns: ['Código', 'Dimensão', 'Score', 'Classificação'],
          data: dimRows.map((d) => [
            d.code,
            d.name,
            d.value != null ? String(d.value) : '—',
            d.value != null ? bandLabelOf(d.value, mapa.bands) : '—',
          ]),
        },
      },
      {
        heading: '4. Principais sinais',
        body:
          'Forças = dimensões com maior resultado; Atenções = menor resultado. Cada leitura ' +
          'narrativa é aprovada pela equipe CRIVO antes de entrar no documento.' +
          (sinais.prose ? `\n\n${sinais.prose}` : ''),
        table: {
          columns: ['Tipo', 'Dimensão/Fator', 'Leitura aprovada'],
          data: [
            ...forces.map((d) => ['Força', `${d.code} · ${d.name} (${d.value})`, sinais.byCode[d.code] ?? '—']),
            ...attentions.map((d) => ['Atenção', `${d.code} · ${d.name} (${d.value})`, sinais.byCode[d.code] ?? '—']),
          ],
        },
      },
      {
        heading: '5. Recomendação de próximo passo',
        rows: [
          {
            label: 'Recomendação',
            value: ctx.cnaeDecision?.recommendedMethod
              ? METHOD_LABEL[ctx.cnaeDecision.recommendedMethod] ?? ctx.cnaeDecision.recommendedMethod
              : 'Conversa com a equipe CRIVO para definição do método',
          },
          {
            label: 'Justificativa',
            value:
              approved['proximo_passo_justificativa'] ??
              (ctx.cnaeDecision
                ? 'Recomendação técnica derivada do enquadramento CNAE/NR-1 registrado para a empresa.'
                : '—'),
          },
        ],
      },
      docControlSection(),
    ];

    return {
      type: 'relatorio_executivo',
      title: DOCUMENT_TYPE_LABEL['relatorio_executivo'],
      subtitle: 'Template final de saída · TPL-001 · Documento executivo preliminar',
      company: ctx.company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  // ── TPL-002 · Dossiê Técnico (template ÚNICO, 14 seções na ordem oficial) ──
  private async generateDossieTecnico(
    tenantId: string,
    ctx: {
      company: string;
      org: {
        legalName: string | null;
        taxId: string | null;
        establishment?: string | null;
        employeesCount?: string | null;
        workModel?: string | null;
      } | null;
      contract: { technicalOutput?: string | null; responsible?: string | null } | null;
      method: DiagnosticMethodLike;
      plans: {
        title: string;
        validatedAt: Date | null;
        validatedBy: string | null;
        items: (FactorItem & { evidences: { title: string; kind: string; url: string | null; status: string; reviewedAt: Date | null }[] })[];
      }[];
      cnaeDecision: CnaeDecisionRow | null;
    },
  ): Promise<GeneratedDocument> {
    const output = ctx.contract?.technicalOutput ?? 'SEM_INTEGRACAO';
    const psy = await this.psychosocialSummary(tenantId);
    const approvedTexts = await this.approvedTextsOf(tenantId, 'dossie_tecnico');
    const plan = ctx.plans.find((p) => p.validatedAt) ?? ctx.plans[0];
    const items = (plan?.items ?? []) as (FactorItem & {
      evidences: { title: string; kind: string; url: string | null; status: string; reviewedAt: Date | null }[];
    })[];

    const meta: GeneratedDocument['meta'] = [
      { label: 'Empresa', value: ctx.org?.legalName ?? ctx.company },
      { label: 'CNPJ', value: ctx.org?.taxId ?? '—' },
      { label: 'Unidade/Estabelecimento', value: ctx.org?.establishment ?? '—' },
      { label: 'Método aplicado', value: ctx.method ? METHOD_LABEL[ctx.method] ?? ctx.method : '—' },
      { label: 'Saída técnica', value: OUTPUT_LABEL[output] ?? output },
      { label: 'Período avaliado', value: psy.period },
      { label: 'Público elegível', value: ctx.org?.employeesCount ?? '—' },
      { label: 'Respostas válidas/adesão', value: adhesionLabel(psy.totalRespondents, ctx.org?.employeesCount) },
      { label: 'Responsável CRIVO', value: ctx.contract?.responsible ?? '—' },
    ];

    const sections: DocumentSection[] = [];

    // Declaração de escopo (título por saída técnica — Bloqueio §3 garantido no generate).
    sections.push({
      heading:
        output === 'AEP_PGR'
          ? 'Declaração de escopo — Integração à AEP + GRO/PGR'
          : 'Declaração de subsídio à AEP',
      body:
        'Este documento registra os fatores de risco psicossociais relacionados ao trabalho ' +
        'identificados no ciclo avaliado, com a finalidade de subsidiar a Avaliação Ergonômica ' +
        'Preliminar (AEP)' +
        (output === 'AEP_PGR' ? ' e a integração ao GRO/PGR' : '') +
        '. Não substitui a AEP, o PGR, nem a validação da empresa ou do responsável técnico.',
    });

    // RESSALVA de rascunho sem ações. Vem logo depois da declaração de escopo,
    // antes de qualquer número: as seções 6, 8, 9 e 11 são tabelas alimentadas
    // por `items` e, com a lista vazia, saem só com travessões — enquanto os
    // CORPOS delas afirmam "plano aprovado" e "somente evidência aprovada
    // compõe a documentação". Sem esta ressalva o leitor recebe declaração de
    // conformidade sem lastro. A emissão OFICIAL neste estado é barrada em
    // emit(); aqui tratamos a pré-visualização, que segue livre de propósito.
    if (!items.length) {
      sections.push({
        heading: 'Ressalva — rascunho sem plano de ação registrado',
        body:
          'Este documento é uma PRÉ-VISUALIZAÇÃO. O plano de ação vinculado não possui nenhuma ação ' +
          'registrada, portanto as tabelas de fatores de risco, plano aprovado, evidências e anexo de ' +
          'inventário saem sem conteúdo. Nada aqui atesta conformidade, ausência de risco ou ' +
          'inexistência de fatores — atesta apenas que o plano ainda não foi preenchido. ' +
          'A emissão oficial permanece bloqueada até que as ações sejam registradas em Plano de Evolução.',
      });
    }

    // 1. Finalidade e limites — texto obrigatório do pacote + complemento
    // APROVADO pela equipe CRIVO (F3), quando existir.
    sections.push({
      heading: '1. Finalidade e limites',
      body:
        'Os documentos gerados pela plataforma CRIVO têm caráter técnico, gerencial e documental ' +
        'para identificação, registro, gestão e acompanhamento dos fatores de risco psicossociais ' +
        'relacionados ao trabalho. A revisão, validação, assinatura e integração formal desses ' +
        'documentos à AEP, ao GRO/PGR e às demais obrigações aplicáveis são de responsabilidade da ' +
        'empresa contratante e/ou do responsável técnico/designado.' +
        (approvedTexts['finalidade_limites'] ? `\n\n${approvedTexts['finalidade_limites']}` : ''),
    });

    // 2. Escopo e fontes da avaliação.
    sections.push({
      heading: '2. Escopo e fontes da avaliação',
      rows: [
        { label: 'Número de empregados', value: ctx.org?.employeesCount ?? '—' },
        { label: 'Áreas/Setores considerados', value: (psy.suppressed ? [] : psy.sectorsList).join(', ') || '—' },
        { label: 'Modelo de trabalho', value: ctx.org?.workModel ?? '—' },
        {
          label: 'Fontes utilizadas',
          value: 'Questionário psicossocial CRIVO; Matriz técnica do diagnóstico; Plano de Evolução; Motor de Evidências',
        },
        { label: 'Versão metodológica', value: await this.activeVersionLabel('PSYCHOSOCIAL') },
        {
          label: 'Regra de confidencialidade',
          value: `Recortes com menos de ${psy.minRespondents} respondentes são omitidos`,
        },
      ],
    });

    // 3. Síntese dos resultados (agregado psicossocial + fatores priorizados).
    const altos = items.filter((i) => factorRisk(i).isHigh);
    sections.push({
      heading: '3. Síntese dos resultados',
      rows: psy.suppressed
        ? [
            {
              label: 'Índice/resultado geral',
              value: `Dados omitidos por confidencialidade — volume mínimo de respostas não atingido (${psy.totalRespondents}/${psy.minRespondents})`,
            },
            { label: 'Principais fatores priorizados', value: altos.map((i) => i.point).join('; ') || '—' },
          ]
        : [
            { label: 'Índice/resultado geral', value: String(psy.score) },
            { label: 'Classificação geral', value: psy.levelLabel },
            { label: 'Principais fatores priorizados', value: altos.map((i) => i.point).join('; ') || '—' },
            {
              label: 'Grupos/áreas prioritários',
              value: [...new Set(altos.map((i) => i.exposedGroup).filter(Boolean))].join(', ') || '—',
            },
          ],
    });

    // 4. Resultados por dimensão (classificação pela régua do instrumento).
    if (!psy.suppressed && psy.byDimension.length) {
      sections.push({
        heading: '4. Resultados por dimensão',
        table: {
          columns: ['Dimensão oficial', 'Resultado', 'Classificação'],
          data: psy.byDimension.map((d) => [d.label, String(d.value), bandLabelOf(d.value, psy.bands)]),
        },
      });
    }

    // 5. Análise por recorte — SÓ Organizacional; Essencial = consolidado (Pacote §3).
    if (ctx.method === 'ORGANIZACIONAL') {
      const adh = await this.sectorAdhesion(tenantId);
      sections.push({
        heading: '5. Análise por recorte',
        body:
          `Adesão por área/setor/turno. Recortes com menos de ${adh.minRespondents} respondentes ` +
          'exibem: "Dados omitidos por confidencialidade. Volume mínimo de respostas não atingido."',
        table: {
          columns: ['Recorte', 'Respondentes', 'Exibição', 'Observação'],
          data: adh.sectors.length
            ? adh.sectors.map((s) => [
                s.sector,
                s.suppressed ? '—' : String(s.respondents),
                s.suppressed ? 'Omitido' : 'Exibido',
                s.suppressed ? 'Dados omitidos por confidencialidade. Volume mínimo de respostas não atingido.' : '—',
              ])
            : [['—', '—', '—', 'Sem respostas registradas']],
        },
      });
    } else {
      sections.push({
        heading: 'Resultados consolidados',
        body:
          'No método Essencial os recortes por área/setor/turno não se aplicam — o resultado é ' +
          'apresentado de forma agregada para a organização.',
      });
    }

    // 6. Matriz técnica de fatores de risco (colunas oficiais).
    sections.push({
      heading: '6. Matriz técnica de fatores de risco',
      table: {
        columns: ['ID', 'Área/Processo', 'Grupo exposto', 'Fator', 'Fonte/Circunstância', 'Sev.', 'Prob.', 'Risco', 'Ação'],
        data: items.length
          ? items.map((i, n) => [
              `FP-${String(n + 1).padStart(3, '0')}`,
              i.areaProcess ?? '—',
              i.exposedGroup ?? '—',
              i.point,
              i.origin ?? '—',
              asRisk3(i.severity) ?? '—',
              asRisk3(i.probability) ?? '—',
              factorRisk(i).label,
              i.action,
            ])
          : [['—', '—', '—', '—', '—', '—', '—', '—', '—']],
      },
    });
    const semMatriz = items.filter((i) => !factorRisk(i).derived).length;
    if (semMatriz > 0) {
      sections.push({
        heading: 'Nota sobre a classificação de risco',
        body:
          `${semMatriz} fator(es) ainda usam a classificação manual anterior. A classificação ` +
          'técnica oficial vem da matriz Severidade × Probabilidade (Baixo/Moderado/Alto).',
      });
    }
    // 7. Medidas existentes — SÓ quando a empresa informou (bloco opcional do
    // dicionário: sem dado, oculta; nunca inventado pelo sistema).
    const withMeasure = items.filter((i) => i.existingMeasure?.trim());
    if (withMeasure.length) {
      sections.push({
        heading: '7. Medidas existentes',
        body: 'Medidas informadas pela própria empresa para os fatores identificados.',
        table: {
          columns: ['Fator', 'Medida existente', 'Avaliação/Observação'],
          data: withMeasure.map((i) => [i.point, i.existingMeasure ?? '—', '—']),
        },
      });
    }

    // 8. Plano de ação aprovado — snapshot do ciclo.
    sections.push({
      heading: '8. Plano de ação aprovado — snapshot do ciclo',
      body:
        (plan
          ? plan.validatedAt
            ? `Plano "${plan.title}" validado por ${plan.validatedBy ?? '—'} em ${fmt(plan.validatedAt)}. `
            : `Plano "${plan.title}" ainda não validado. `
          : 'Nenhum plano registrado. ') +
        'Este bloco NÃO cria nem edita ações — apenas reproduz o estado aprovado do Plano de Evolução no momento da emissão.',
      table: {
        columns: ['ID', 'Ação aprovada', 'Responsável', 'Prazo', 'Indicador', 'Evidência esperada', 'Status'],
        data: items.length
          ? items.map((i, n) => [
              `A-${String(n + 1).padStart(3, '0')}`,
              i.action,
              i.responsible ?? '—',
              i.dueDate ? fmt(i.dueDate) : '—',
              i.indicator ?? '—',
              i.expectedEvidence ?? '—',
              ACTION_LABEL[i.status] ?? i.status,
            ])
          : [['—', '—', '—', '—', '—', '—', '—']],
      },
    });

    // 9. Evidências (só APROVADA compõe; demais são declaradas como excluídas).
    const allEvid = items.flatMap((i) => i.evidences);
    const approved = allEvid.filter((e) => e.status === 'APROVADA');
    sections.push({
      heading: '9. Evidências',
      // Sem NENHUMA evidência anexada, `approved.length === allEvid.length` é
      // 0 === 0 e a frase positiva saía sozinha — lida como "conferimos e está
      // tudo aprovado" quando o correto é "não há nada para conferir".
      body: !allEvid.length
        ? 'Nenhuma evidência anexada até o momento. A regra permanece: somente evidência aprovada ' +
          'compõe a documentação técnica — esta seção fica vazia até que haja evidência anexada e validada.'
        : approved.length === allEvid.length
          ? 'Somente evidência aprovada compõe a documentação técnica.'
          : `Somente evidência aprovada compõe a documentação técnica. ${allEvid.length - approved.length} evidência(s) não incluída(s) por não estarem validadas.`,
      table: {
        columns: ['Evidência', 'Tipo', 'Vínculo/Referência', 'Status', 'Validada em'],
        data: approved.length
          ? approved.map((e) => [e.title, e.kind, e.url ?? '—', 'Aprovada', e.reviewedAt ? fmt(e.reviewedAt) : '—'])
          : [['—', '—', '—', '—', '—']],
      },
    });

    // 10. Registro de comunicação e devolutiva — SÓ quando a empresa registrou.
    const devolutivas = await this.prisma.forTenant(tenantId, (tx) =>
      tx.devolutivaRecord.findMany({ orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 10 }),
    );
    if (devolutivas.length) {
      sections.push({
        heading: '10. Registro de comunicação e devolutiva',
        body: 'Comunicações dos resultados e medidas aos trabalhadores, registradas pela empresa.',
        table: {
          columns: ['Data', 'Formato', 'Público envolvido', 'Temas comunicados', 'Pontos confirmados', 'Medidas comunicadas'],
          data: devolutivas.map((r) => [
            fmt(r.date),
            r.format,
            r.audience ?? '—',
            r.topics ?? '—',
            r.confirmedPoints ?? '—',
            r.communicatedMeasures ?? '—',
          ]),
        },
      });
    }

    // 11. Anexo técnico para inventário — SÓ quando a saída integra AEP+GRO/PGR.
    if (output === 'AEP_PGR') {
      sections.push({
        heading: '11. Anexo técnico para integração ao inventário',
        body:
          'Relação dos fatores psicossociais para integração ao inventário de riscos do GRO/PGR ' +
          'pelo responsável técnico, após validação da empresa.',
        table: {
          columns: ['ID risco', 'Processo', 'Fator psicossocial', 'Fonte/Circunstância', 'Grupo exposto', 'Medida existente', 'Risco', 'Ação'],
          data: items.length
            ? items.map((i, n) => [
                `R-${String(n + 1).padStart(3, '0')}`,
                i.areaProcess ?? '—',
                i.point,
                i.origin ?? '—',
                i.exposedGroup ?? '—',
                i.existingMeasure ?? '—',
                factorRisk(i).label,
                i.action,
              ])
            : [['—', '—', '—', '—', '—', '—', '—', '—']],
        },
      });
    }

    // 12. Indicação de integração documental (tabela fixa do pacote).
    sections.push({
      heading: '12. Indicação de integração documental',
      table: {
        columns: ['Elemento do dossiê', 'Destino recomendado'],
        data: [
          ['Matriz de fatores', 'Registro da AEP e base para inventário de riscos ocupacionais.'],
          ['Anexo técnico', 'Inventário de riscos ocupacionais, após validação da empresa/responsável.'],
          ['Plano de ação aprovado', 'Plano de ação do PGR/GRO ou plano preventivo vinculado à AEP.'],
          ['Evidências', 'Registros de implementação e acompanhamento.'],
        ],
      },
    });

    // Base Técnica da Recomendação (Motor CNAE/NR-1) — complementa o dossiê.
    sections.push(buildBaseTecnicaSection(ctx.cnaeDecision));

    // 13. Conclusão e validação — assinatura FORA do sistema (decisão 27/07).
    // F3: a CONCLUSÃO TÉCNICA aprovada pela equipe CRIVO abre a seção; o texto
    // fixo de responsabilidade do pacote permanece em seguida.
    sections.push(
      signatureSection(
        (approvedTexts['conclusao_tecnica'] ? `${approvedTexts['conclusao_tecnica']}\n\n` : '') +
          'A revisão, validação, assinatura e integração formal deste documento à AEP, ao GRO/PGR e ' +
          'às demais obrigações aplicáveis são de responsabilidade da empresa contratante e/ou do ' +
          'responsável técnico/designado. A empresa baixa o documento, assina fora do sistema e o ' +
          'integra ao seu AEP/GRO/PGR.',
      ),
    );

    // 14. Controle documental.
    sections.push(docControlSection());

    return {
      type: 'dossie_tecnico',
      title: DOCUMENT_TYPE_LABEL['dossie_tecnico'],
      subtitle: 'Template-base final · TPL-002 · Documento técnico controlado',
      company: ctx.company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  // ── TPL-003 · Relatório de Evolução e Efetividade (layout oficial) ─────────
  /**
   * Compara os DOIS últimos ciclos formais ENCERRADOS, fator a fator, usando os
   * snapshots congelados no encerramento. Colunas derivadas (RESULTADO,
   * AVALIAÇÃO) vêm exclusivamente da matriz de risco e do status REGISTRADOS —
   * a leitura final é da empresa/responsável técnico (nota no §4).
   */
  private async generateRelatorioEvolucao(
    tenantId: string,
    ctx: {
      company: string;
      org: { legalName: string | null; taxId: string | null } | null;
      contract: { responsible?: string | null } | null;
      method: DiagnosticMethodLike;
    },
  ): Promise<GeneratedDocument> {
    const comparable = await this.comparableCycles(tenantId);
    if (!comparable.ok) throw new BadRequestException(comparable.reason);
    const { previous, current } = comparable;
    const approvedTexts = await this.approvedTextsOf(tenantId, 'relatorio_evolucao');

    type SnapFactor = {
      point: string; action: string; risk: string; riskDerived: boolean; status: string;
      areaProcess: string | null; indicator: string | null;
      evidences: { title: string; status: string }[];
    };
    const factorsOf = (c: typeof current): SnapFactor[] =>
      ((c.snapshot as { factors?: SnapFactor[] } | null)?.factors ?? []);
    const prevFactors = factorsOf(previous);
    const curFactors = factorsOf(current);
    const norm = (s: string) => s.trim().toLowerCase();
    const prevByPoint = new Map(prevFactors.map((f) => [norm(f.point), f]));
    const curPoints = new Set(curFactors.map((f) => norm(f.point)));

    const cycleRange = (c: typeof current) =>
      `${fmt(c.openedAt)} a ${c.closedAt ? fmt(c.closedAt) : '—'}`;
    const methodLabel = (m: string | null) => (m ? METHOD_LABEL[m] ?? m : null);
    const vPrev = previous.methodologyVersion ?? '—';
    const vCur = current.methodologyVersion ?? '—';
    // '—' não é versão comparável: sem registro em um dos ciclos, a
    // compatibilidade é DESCONHECIDA (nunca afirmada como "mesma versão").
    const compat =
      vPrev === '—' || vCur === '—'
        ? 'Versão metodológica não registrada em um dos ciclos — comparação com ressalva'
        : vPrev === vCur
          ? `Mesma versão metodológica (${vCur})`
          : `Versões metodológicas diferentes (${vPrev} → ${vCur}) — comparação com ressalva`;

    const meta: GeneratedDocument['meta'] = [
      { label: 'Empresa', value: ctx.org?.legalName ?? ctx.company },
      { label: 'CNPJ', value: ctx.org?.taxId ?? '—' },
      { label: 'Ciclo anterior', value: `${previous.label} (${cycleRange(previous)})` },
      { label: 'Ciclo atual', value: `${current.label} (${cycleRange(current)})` },
      {
        label: 'Método',
        value: methodLabel(current.method) ?? (ctx.method ? METHOD_LABEL[ctx.method] ?? ctx.method : '—'),
      },
      { label: 'Compatibilidade metodológica', value: compat },
      { label: 'Responsável CRIVO', value: ctx.contract?.responsible ?? '—' },
    ];

    const sections: DocumentSection[] = [];

    // 1. FINALIDADE — texto do template oficial.
    sections.push({
      heading: '1. Finalidade',
      body:
        'Comparar a evolução dos fatores de riscos psicossociais, o status das ações, as evidências ' +
        'e a efetividade das medidas entre ciclos formais de diagnóstico.',
    });

    // 2. SÍNTESE DA EVOLUÇÃO — texto APROVADO pela equipe CRIVO (F3).
    sections.push({
      heading: '2. Síntese da evolução',
      body:
        approvedTexts['sintese_evolucao'] ??
        'Síntese da evolução pendente de aprovação pela equipe CRIVO (a IA da Plataforma rascunha, ' +
          'a equipe revisa e aprova no Super Admin). A emissão oficial inclui a síntese aprovada.',
    });

    // 3. COMPARATIVO DOS FATORES — união dos fatores dos dois snapshots.
    const evidCell = (f: SnapFactor) => {
      const ok = f.evidences.filter((e) => e.status === 'APROVADA').length;
      return ok > 0 ? `${ok} aprovada(s)` : '—';
    };
    const compRows: string[][] = curFactors.map((f) => {
      const before = prevByPoint.get(norm(f.point));
      return [
        f.point,
        before ? before.risk : '— (novo)',
        f.risk,
        f.action,
        evidCell(f),
        evolutionResult(before?.risk ?? null, f.risk),
      ];
    });
    for (const f of prevFactors) {
      if (curPoints.has(norm(f.point))) continue;
      compRows.push([f.point, f.risk, '— (fora do plano)', f.action, evidCell(f), evolutionResult(f.risk, null)]);
    }
    sections.push({
      heading: '3. Comparativo dos fatores',
      body:
        'Risco anterior e atual congelados no encerramento de cada ciclo (matriz Severidade × ' +
        'Probabilidade). O resultado é derivado da variação do risco registrado.',
      table: {
        columns: ['Fator', 'Risco anterior', 'Risco atual', 'Ação', 'Evidência', 'Resultado'],
        data: compRows,
      },
    });

    // 4. EFETIVIDADE DAS AÇÕES — derivação mecânica de risco/status registrados.
    const NEXT_DECISION: Record<string, string> = {
      CONCLUIDA: 'Manter e monitorar',
      EM_ANDAMENTO: 'Continuar execução',
      APROVADA: 'Executar conforme plano',
      REAVALIADA: 'Reavaliar no próximo ciclo',
      SUGERIDA: 'Aprovar/revisar a ação',
      EM_REVISAO: 'Aprovar/revisar a ação',
    };
    sections.push({
      heading: '4. Efetividade das ações',
      body:
        'Avaliação DERIVADA da variação do risco e do status registrados — não substitui a leitura ' +
        'da empresa e/ou do responsável técnico, que valida este documento na conclusão.',
      table: {
        columns: ['Ação', 'Status', 'Avaliação de efetividade', 'Próxima decisão'],
        data: curFactors.map((f) => {
          const before = prevByPoint.get(norm(f.point));
          const res = before ? evolutionResult(before.risk, f.risk) : null;
          // Cada resultado tem leitura EXPLÍCITA — "Comparação indisponível"
          // nunca vira "estável" (seria conclusão fabricada em doc oficial).
          const aval = !before
            ? 'Fator novo neste ciclo — sem base de comparação'
            : res === 'Risco reduzido'
              ? `Risco reduzido (${before.risk} → ${f.risk})`
              : res === 'Risco agravado'
                ? `Risco agravado (${before.risk} → ${f.risk})`
                : res === 'Estável'
                  ? `Risco estável (${f.risk})`
                  : 'Comparação indisponível — risco não classificado em um dos ciclos';
          return [f.action, ACTION_LABEL[f.status] ?? f.status, aval, NEXT_DECISION[f.status] ?? '—'];
        }),
      },
    });

    // 5. FATORES PERSISTENTES E NOVAS AÇÕES — presentes nos DOIS ciclos sem redução.
    const persistent = curFactors.filter((f) => {
      const before = prevByPoint.get(norm(f.point));
      if (!before) return false;
      const a = riskRank(before.risk);
      const b = riskRank(f.risk);
      return a != null && b != null && b >= a;
    });
    // Fatores comuns cuja comparação de risco é INDISPONÍVEL não podem ser
    // afirmados nem como persistentes nem como reduzidos — contados à parte.
    const unavailableCount = curFactors.filter((f) => {
      const before = prevByPoint.get(norm(f.point));
      if (!before) return false;
      return riskRank(before.risk) == null || riskRank(f.risk) == null;
    }).length;
    sections.push({
      heading: '5. Fatores persistentes e novas ações',
      body: persistent.length
        ? 'Fatores presentes nos dois ciclos sem redução de risco. A justificativa é registro da empresa.' +
          (unavailableCount ? ` ${unavailableCount} fator(es) comum(ns) com comparação indisponível não entram nesta leitura.` : '')
        : unavailableCount
          ? `Nenhum fator persistente CLASSIFICÁVEL entre os ciclos — ${unavailableCount} fator(es) comum(ns) com comparação de risco indisponível (risco não classificado em um dos ciclos).`
          : 'Nenhum fator persistente entre os ciclos comparados — todos os fatores comuns tiveram redução de risco ou saíram do plano.',
      table: persistent.length
        ? {
            columns: ['Fator', 'Justificativa', 'Nova decisão/ação'],
            data: persistent.map((f) => [f.point, '— (registro da empresa)', f.action]),
          }
        : undefined,
    });

    // 6. EVIDÊNCIAS DO CICLO — só evidência APROVADA (regra do pacote v3.1).
    const evidRows: string[][] = [];
    for (const f of curFactors) {
      for (const e of f.evidences) {
        if (e.status !== 'APROVADA') continue;
        evidRows.push([`EV-${String(evidRows.length + 1).padStart(3, '0')}`, e.title, f.point, 'Aprovada']);
      }
    }
    sections.push({
      heading: '6. Evidências do ciclo',
      body: evidRows.length
        ? 'Somente evidência aprovada compõe a documentação técnica.'
        : 'Nenhuma evidência aprovada registrada no ciclo atual.',
      table: evidRows.length
        ? { columns: ['ID', 'Evidência', 'Vínculo', 'Status'], data: evidRows }
        : undefined,
    });

    // 7. CONCLUSÃO E VALIDAÇÃO — conclusão aprovada (F3) + assinatura fora do sistema.
    sections.push(
      signatureSection(
        (approvedTexts['conclusao_evolucao'] ? `${approvedTexts['conclusao_evolucao']}\n\n` : '') +
          'A revisão, validação, assinatura e integração formal deste documento às obrigações ' +
          'aplicáveis são de responsabilidade da empresa contratante e/ou do responsável ' +
          'técnico/designado. A empresa baixa o documento, assina fora do sistema e o integra à ' +
          'sua documentação.',
      ),
    );

    // 8. CONTROLE DOCUMENTAL.
    sections.push(docControlSection());

    return {
      type: 'relatorio_evolucao',
      title: DOCUMENT_TYPE_LABEL['relatorio_evolucao'],
      subtitle: 'Template final · TPL-003 · Documento técnico controlado',
      company: ctx.company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  // ── TPL-004 · Extrato do Plano de Ação Preventivo (layout oficial) ─────────
  private async generateExtratoPlano(
    tenantId: string,
    ctx: {
      company: string;
      org: { taxId: string | null } | null;
      plans: {
        title: string;
        source: string | null;
        validatedAt: Date | null;
        validatedBy: string | null;
        updatedAt: Date;
        items: (FactorItem & { id: string })[];
      }[];
    },
  ): Promise<GeneratedDocument> {
    const plan = ctx.plans.find((p) => p.validatedAt) ?? ctx.plans[0];
    const items = plan?.items ?? [];

    // F2 — última alteração registrada de cada ação (action_item_history).
    const historyRows: string[][] = [];
    if (items.length) {
      const ids = items.map((i) => i.id);
      const hist = await this.prisma.forTenant(tenantId, (tx) =>
        tx.actionItemHistory.findMany({
          where: { actionItemId: { in: ids } },
          // Tiebreak por id: duas linhas no mesmo milissegundo não podem tornar
          // a "última alteração" (e o hash da emissão) não determinísticos.
          orderBy: [{ at: 'desc' }, { id: 'desc' }],
        }),
      );
      const lastByItem = new Map<string, (typeof hist)[number]>();
      for (const h of hist) if (!lastByItem.has(h.actionItemId)) lastByItem.set(h.actionItemId, h);
      for (const i of items) {
        const h = lastByItem.get(i.id);
        if (!h) continue;
        historyRows.push([
          i.action,
          h.change,
          h.changedBy ?? '—',
          plan?.validatedBy ?? '—',
          fmt(h.at),
        ]);
      }
    }

    const meta: GeneratedDocument['meta'] = [
      { label: 'Empresa', value: ctx.company },
      { label: 'Origem', value: plan?.source ?? '—' },
      { label: 'Ciclo', value: '—' },
      // Data derivada do DADO (última alteração do plano), não do relógio —
      // usar new Date() aqui mudava o hash todo dia e quebrava a idempotência.
      { label: 'Data de referência', value: plan?.updatedAt ? fmt(plan.updatedAt) : '—' },
      { label: 'Status do plano', value: plan?.validatedAt ? 'Validado' : 'Minuta' },
    ];

    const sections: DocumentSection[] = [
      {
        heading: 'Documento operacional controlado',
        body:
          'Este documento é uma exportação do Plano de Evolução. Não existe cadastro paralelo de ' +
          'ações no Motor de Relatórios.',
      },
      {
        heading: '1. Ações aprovadas',
        table: {
          columns: ['ID', 'Fator/Risco', 'Ação aprovada', 'Responsável', 'Prazo', 'Indicador', 'Evidência esperada', 'Status'],
          data: items.length
            ? items.map((i, n) => [
                `A-${String(n + 1).padStart(3, '0')}`,
                `${i.point} (${factorRisk(i).label})`,
                i.action,
                i.responsible ?? '—',
                i.dueDate ? fmt(i.dueDate) : '—',
                i.indicator ?? '—',
                i.expectedEvidence ?? '—',
                ACTION_LABEL[i.status] ?? i.status,
              ])
            : [['—', '—', '—', '—', '—', '—', '—', '—']],
        },
      },
      {
        heading: '2. Histórico e validação',
        body:
          'Última alteração registrada por ação (trilha do Plano de Evolução). A validação do ' +
          'plano é registrada no nível do documento.',
        table: {
          columns: ['Ação', 'Última alteração', 'Alterado por', 'Validado por', 'Data'],
          data: historyRows.length
            ? historyRows
            : [
                [
                  plan ? `Plano "${plan.title}" (todas as ações)` : '—',
                  '—',
                  '—',
                  plan?.validatedBy ?? '—',
                  plan?.validatedAt ? fmt(plan.validatedAt) : '—',
                ],
              ],
        },
      },
      docControlSection(),
    ];

    return {
      type: 'plano_acao',
      title: DOCUMENT_TYPE_LABEL['plano_acao'],
      subtitle: 'Exportação opcional do Plano de Evolução · TPL-004',
      company: ctx.company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  /** Monta o conteúdo estruturado do documento a partir dos dados reais. */
  async generate(
    tenantId: string,
    type: string,
    ctxIn?: Awaited<ReturnType<DocumentsService['context']>>,
  ): Promise<GeneratedDocument> {
    // emit() passa o contexto que ele já leu — a emissão oficial congela UM
    // retrato do banco do começo ao fim (gate, conteúdo e hash).
    const ctx = ctxIn ?? (await this.context(tenantId));
    const { contract, method, org, company, plans, cnaeDecision } = ctx;
    const isTemplate = type.startsWith('tpl:');
    if (!isTemplate && !DOCUMENT_TYPE_LABEL[type]) {
      throw new BadRequestException('Tipo de documento inválido');
    }

    // GATE server-side: repetir a elegibilidade de available(). Sem isto, bastava
    // chamar generate() com um tipo válido para emitir documento que o contrato
    // não libera (ou sem plano validado) — brecha de autorização de saída.
    // Mesmo retrato do banco que monta o conteúdo abaixo: portão e documento
    // não podem discordar sobre qual plano está valendo.
    const eligible = await this.available(tenantId, ctx);
    const desc = eligible.find((d) => d.type === type);
    if (!desc || !desc.available) {
      throw new BadRequestException(
        desc?.reason ?? 'Este documento não está liberado para o contrato desta empresa.',
      );
    }

    // Relatório cadastrado no Motor 4 e vinculado a um diagnóstico do motor.
    if (isTemplate) {
      return this.generateFromTemplate(tenantId, type.slice(4), {
        company,
        contract,
        method,
        plans,
      });
    }

    const output = contract?.technicalOutput ?? 'SEM_INTEGRACAO';

    // Bloqueio §3: não emitir com título incompatível com a saída técnica.
    // O Dossiê Técnico exige saída AEP ou AEP+GRO/PGR — sem isso, o título do
    // documento não corresponderia ao que ele pode declarar.
    if (type === 'dossie_tecnico' && output !== 'AEP' && output !== 'AEP_PGR') {
      throw new BadRequestException(
        'Título incompatível com a saída técnica: o Dossiê Técnico exige saída AEP ou AEP + GRO/PGR no contrato.',
      );
    }

    // ── Templates-base do Pacote Final: builders no layout oficial ───────────
    if (type === 'relatorio_executivo') {
      return this.generateMapaExecutivo(tenantId, { company, org, cnaeDecision });
    }
    if (type === 'plano_acao') {
      return this.generateExtratoPlano(tenantId, { company, org, plans });
    }
    if (type === 'dossie_tecnico') {
      return this.generateDossieTecnico(tenantId, { company, org, contract, method, plans, cnaeDecision });
    }
    if (type === 'relatorio_evolucao') {
      return this.generateRelatorioEvolucao(tenantId, { company, org, contract, method });
    }

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
    // (relatorio_executivo, plano_acao e dossie_tecnico saem pelos builders
    //  oficiais acima e nunca chegam a este fluxo comum.)

    // #13 — Declaração de escopo dos dossiês LEGADOS (emissões antigas só).
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

    sections.push(docControlSection());

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
    // Snapshot do contexto no momento da emissão — método EFETIVO (solução
    // contratada primeiro), o mesmo que aparece no documento e no portal.
    const ctxEmissao = await this.context(tenantId);
    const { contract, method, org, plans } = ctxEmissao;

    // EMISSÃO FINAL — plano validado mas SEM ações não sustenta documento técnico.
    // dossierBlockers() não pega este caso: seus três filtros rodam SOBRE a lista
    // de ações, então com a lista vazia nenhum dispara e o gate liberava um
    // dossiê cujo corpo afirma "plano aprovado" (§8) e "somente evidência
    // aprovada compõe a documentação" (§9) — com zero de cada, e sem ressalva.
    // Mesma decisão dos demais gates de emissão: o rascunho segue livre.
    if (type === 'dossie_tecnico' || type === 'plano_acao') {
      const base = plans.find((p) => p.validatedAt) ?? plans[0];
      if (!base?.items.length) {
        throw new BadRequestException(
          'Emissão final bloqueada — o plano de ação não tem nenhuma ação registrada. ' +
            'Um documento técnico emitido neste estado afirmaria plano aprovado e evidência ' +
            'aprovada sem ter nenhum dos dois. Registre as ações em Plano de Evolução; ' +
            'a pré-visualização (rascunho) continua disponível.',
        );
      }
    }

    // EMISSÃO FINAL (decisão do cliente 27/07): o rascunho/pré-visualização é
    // livre, mas os documentos TÉCNICOS só são emitidos com a identificação
    // completa da organização — o PGR reúne inventário e plano sob
    // responsabilidade do empregador, então o vínculo precisa ser inequívoco.
    if (type === 'dossie_tecnico' || type === 'relatorio_evolucao') {
      const missing: string[] = [];
      if (!org?.legalName?.trim()) missing.push('razão social');
      if (!org?.taxId?.trim()) missing.push('CNPJ/identificador legal');
      if (!method) missing.push('método aplicado');
      if (!contract?.responsible?.trim()) missing.push('responsável da empresa');
      if (missing.length) {
        throw new BadRequestException(
          `Emissão final bloqueada — complete no cadastro/contrato: ${missing.join(', ')}. ` +
            'A pré-visualização (rascunho) continua disponível.',
        );
      }
    }

    // F3/F4 (dicionário do pacote: variável OBRIGATÓRIA ausente = bloqueia a
    // emissão): os textos obrigatórios precisam estar APROVADOS pela equipe
    // CRIVO (decisão 1-A). O rascunho/pré-visualização continua livre.
    const requiredText: Record<string, { field: string; label: string }[]> = {
      relatorio_executivo: [{ field: 'sintese_executiva', label: 'Síntese executiva' }],
      dossie_tecnico: [{ field: 'conclusao_tecnica', label: 'Conclusão técnica' }],
      relatorio_evolucao: [
        { field: 'sintese_evolucao', label: 'Síntese da evolução' },
        { field: 'conclusao_evolucao', label: 'Conclusão' },
      ],
    };
    // Mensagem em tom de CLIENTE — quem emite é o portal do tenant, e a
    // aprovação é uma etapa da equipe CRIVO (o cliente não tem essa tela).
    const reqs = requiredText[type] ?? [];
    const requiredTextError = (labels: string[]) =>
      new BadRequestException(
        `Emissão aguardando aprovação da equipe CRIVO — texto(s) obrigatório(s) em elaboração/revisão: ` +
          `${labels.join(', ')}. A pré-visualização (rascunho) continua disponível; a emissão oficial ` +
          'é liberada assim que a equipe CRIVO aprovar.',
      );
    if (reqs.length) {
      const approved = await this.approvedTextsOf(tenantId, type);
      const missing = reqs.filter((r) => !approved[r.field]).map((r) => r.label);
      if (missing.length) throw requiredTextError(missing);
    }

    // F4: os textos do Relatório de Evolução são aprovados SOBRE um comparativo
    // específico. Se um ciclo foi encerrado DEPOIS da aprovação, o par comparado
    // mudou — o texto antigo descreveria outra comparação. Exige reaprovação.
    if (type === 'relatorio_evolucao') {
      const comparable = await this.comparableCycles(tenantId);
      if (comparable.ok && comparable.current.closedAt) {
        // rls-allow: approved_texts é control-plane (owner) — leitura de metadado.
        const rows = await this.prisma.admin.approvedText.findMany({
          where: { tenantId, docType: type, field: { in: reqs.map((r) => r.field) } },
          select: { field: true, approvedAt: true },
        });
        const cutoff = comparable.current.closedAt.getTime();
        const stale = reqs
          .filter((r) => {
            const at = rows.find((x) => x.field === r.field)?.approvedAt;
            return !at || at.getTime() < cutoff;
          })
          .map((r) => r.label);
        if (stale.length) {
          throw new BadRequestException(
            `Emissão aguardando reaprovação da equipe CRIVO — o ciclo atual foi encerrado depois da ` +
              `aprovação de: ${stale.join(', ')}. O texto precisa ser reaprovado sobre o comparativo novo.`,
          );
        }
      }
    }

    const doc = await this.generate(tenantId, type, ctxEmissao); // reaplica elegibilidade + bloqueios
    // Re-checagem PÓS-geração (TOCTOU): se a aprovação for revogada entre o
    // gate acima e a leitura feita pelo gerador, o documento sairia com o
    // placeholder "pendente de aprovação" congelado numa emissão oficial.
    if (reqs.length) {
      const stillApproved = await this.approvedTextsOf(tenantId, type);
      const missing = reqs.filter((r) => !stillApproved[r.field]).map((r) => r.label);
      if (missing.length) throw requiredTextError(missing);
    }
    // Hash de integridade sobre o CONTEÚDO estável — generatedAt muda a cada
    // geração e não pode participar, senão a idempotência nunca dispara.
    const { generatedAt: _volatile, ...stable } = doc;
    const contentHash = createHash('sha256').update(JSON.stringify(stable)).digest('hex');
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
      const emissionNumber = (last?.emissionNumber ?? 0) + 1;
      // Carimbo do CONTROLE DOCUMENTAL no conteúdo congelado: status "Documento
      // emitido" + versão + data + hash reais. Feito APÓS o cálculo do hash — a
      // idempotência compara o conteúdo SEM o carimbo (determinístico). Só a
      // ÚLTIMA seção com esse título é substituída (os geradores sempre a põem
      // por último) — uma seção de texto livre homônima criada no Super Admin
      // em um modelo do Motor 4 não é tocada.
      const controlIdx = doc.sections.map((s) => s.heading).lastIndexOf('Controle documental');
      const emittedDoc: GeneratedDocument = {
        ...doc,
        sections: doc.sections.map((s, i) =>
          i === controlIdx
            ? {
                heading: 'Controle documental',
                rows: [
                  { label: 'Status do documento', value: 'Documento emitido' },
                  { label: 'Versão do documento', value: `v${emissionNumber}` },
                  { label: 'Data de emissão', value: fmt(new Date()) },
                  { label: 'Validação', value: 'Assinatura fora do sistema (empresa e responsável técnico)' },
                  { label: 'Hash/Identificador', value: contentHash.slice(0, 16) },
                ],
              }
            : s,
        ),
      };
      const emission = await tx.reportEmission.create({
        data: {
          tenantId,
          type,
          title: doc.title,
          emissionNumber,
          method,
          technicalOutput: contract?.technicalOutput ?? null,
          content: emittedDoc as unknown as object,
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
