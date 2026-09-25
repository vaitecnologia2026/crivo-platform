import { describe, expect, it, vi } from 'vitest';
import {
  psychosocialRiskClass,
  PSYCHOSOCIAL_RISK_PLAN_REQUIRED,
  type GeneratedDocument,
  type PsychosocialRiskMatrixRow,
} from '@crivo/types';

/**
 * GABARITO do Dossiê Técnico Organizacional — modelo final ajustado de 25/09
 * (CRIVO_Dossie_Organizacional_Final_Ajustado.pdf, que substitui o de 23/09.
 * Massa Ouro: O2 LEGACY, 19 convidados e 19 respostas, GHEs Recursos Humanos 7 ·
 * Financeiro 6 · Operações 6). Os números de entrada são os do PDF; a saída tem de reproduzir
 * texto, colunas, ordem e numeração do documento. Se um valor aqui mudar, o
 * Dossiê deixou de bater com o modelo que o cliente homologa.
 */
vi.mock('../admin/engine-config', () => ({
  getEngineConfig: vi.fn(async () => ({ minRespondents: 5 })),
  resolveMinRespondents: vi.fn(async () => 5),
}));
vi.mock('../admin/methodology.service', () => ({
  resolveActiveMethodology: vi.fn(async () => null),
  resolveInstrumentForTenant: vi.fn(),
  resolveTenantInstrument: vi.fn(),
  usesPsychosocialEngine: vi.fn(),
}));

import { DocumentsService } from './documents.service';
import {
  cardAcaoHtml,
  cnpjFormatado,
  leituraDoGhe,
  numerarAcoes,
  participacaoDoCiclo,
  tabelaPanorama,
  tituloDaAcao,
  type AcaoPlano,
} from './dossie-organizacional';

const DIM = {
  d1: 'Demandas e Ritmo de Trabalho',
  d2: 'Autonomia e Participação',
  d3: 'Clareza de Papel e Conteúdo do Trabalho',
  d4: 'Recursos e Condições de Execução',
  d5: 'Liderança e Suporte',
  d6: 'Relações, Respeito e Segurança Psicológica',
  d7: 'Reconhecimento e Justiça Organizacional',
  d8: 'Mudanças e Previsibilidade',
  d9: 'Estabilidade e Segurança do Vínculo',
  d10: 'Jornada, Recuperação e Equilíbrio Trabalho-Vida',
} as const;

// Anexo técnico do PDF (págs. 9 e 10): código, fator, dimensão, exposição, P, S.
const ANEXO: [string, string, keyof typeof DIM, number, number, number][] = [
  ['RPS-001', 'Sobrecarga de trabalho', 'd1', 3.58, 4, 4],
  ['RPS-002', 'Pressão de tempo contínua', 'd1', 2.0, 2, 3],
  ['RPS-003', 'Demandas simultâneas e interrupções recorrentes', 'd1', 3.58, 4, 3],
  ['RPS-004', 'Exigências emocionais elevadas', 'd1', 2.0, 2, 3],
  ['RPS-005', 'Baixa autonomia', 'd2', 3.84, 5, 2],
  ['RPS-006', 'Controle excessivo sobre a execução do trabalho', 'd2', 2.0, 2, 3],
  ['RPS-007', 'Baixa influência em decisões do trabalho', 'd2', 2.21, 2, 2],
  ['RPS-008', 'Baixa participação na melhoria do trabalho', 'd2', 2.0, 2, 2],
  ['RPS-009', 'Baixa clareza de papel', 'd3', 1.63, 2, 2],
  ['RPS-010', 'Conflito de papel e prioridades', 'd3', 2.0, 2, 3],
  ['RPS-011', 'Inadequação entre atividades e responsabilidades', 'd3', 2.0, 2, 3],
  ['RPS-012', 'Baixo significado percebido do trabalho', 'd3', 1.63, 2, 2],
  ['RPS-013', 'Falta de informação para execução', 'd4', 1.63, 2, 2],
  ['RPS-014', 'Recursos insuficientes para execução', 'd4', 2.0, 2, 3],
  ['RPS-015', 'Dimensionamento inadequado de pessoal', 'd4', 2.0, 2, 4],
  ['RPS-016', 'Processos inadequados e retrabalho', 'd4', 2.0, 2, 3],
  ['RPS-017', 'Falta de clareza da liderança', 'd5', 2.0, 2, 3],
  ['RPS-018', 'Falta de suporte gerencial', 'd5', 3.58, 4, 3],
  ['RPS-019', 'Feedback insuficiente ou inadequado', 'd5', 2.21, 2, 2],
  ['RPS-020', 'Omissão da liderança diante de condições inadequadas', 'd5', 2.0, 2, 3],
  ['RPS-021', 'Falta de apoio social no trabalho', 'd6', 1.63, 2, 3],
  ['RPS-022', 'Baixa segurança psicológica', 'd6', 2.0, 2, 4],
  ['RPS-023', 'Assédio e condutas hostis', 'd6', 2.0, 2, 4],
  ['RPS-024', 'Fragilidade na prevenção e tratamento de discriminação, agressão ou violência', 'd6', 2.0, 2, 4],
  ['RPS-025', 'Falta de reconhecimento', 'd7', 2.21, 2, 3],
  ['RPS-026', 'Baixa transparência em reconhecimento e recompensas', 'd7', 2.0, 2, 3],
  ['RPS-027', 'Baixa justiça organizacional', 'd7', 1.63, 2, 3],
  ['RPS-028', 'Tratamento inequitativo', 'd7', 2.0, 2, 3],
  ['RPS-029', 'Mudanças sem previsibilidade', 'd8', 2.0, 2, 3],
  ['RPS-030', 'Comunicação inadequada de mudanças', 'd8', 2.0, 2, 3],
  ['RPS-031', 'Baixa participação em mudanças', 'd8', 2.0, 2, 3],
  ['RPS-032', 'Imprevisibilidade operacional', 'd8', 1.63, 2, 3],
  ['RPS-033', 'Insegurança no emprego', 'd9', 2.0, 2, 4],
  ['RPS-034', 'Insegurança sobre condições de trabalho', 'd9', 2.0, 2, 4],
  ['RPS-035', 'Falta de transparência diante de incertezas', 'd9', 1.63, 2, 3],
  ['RPS-036', 'Ameaça de perda do emprego ou piora das condições como pressão', 'd9', 2.0, 2, 4],
  ['RPS-037', 'Jornada inadequada e recuperação insuficiente', 'd10', 2.0, 2, 4],
  ['RPS-038', 'Pausas e intervalos insuficientes', 'd10', 2.0, 2, 3],
  ['RPS-039', 'Extensão recorrente da jornada', 'd10', 2.0, 2, 4],
  ['RPS-040', 'Hiperconectividade e interferência no descanso', 'd10', 1.63, 2, 3],
];
// "57,9%" = 11 de 19; "78,9%" = 15 de 19 (Inventário técnico, pág. 5).
const ALTA: Record<string, number> = { 'RPS-001': 11, 'RPS-003': 11, 'RPS-018': 11, 'RPS-005': 15 };
const AGRAVOS: Record<string, string> = {
  'RPS-001': 'Fadiga, estresse relacionado ao trabalho, queda de atenção e desempenho, absenteísmo e possível esgotamento relacionado ao trabalho.',
  'RPS-003': 'Fadiga cognitiva, perda de concentração, aumento de erros, retrabalho e estresse relacionado ao trabalho.',
  'RPS-018': 'Estresse, sensação de desamparo, redução de confiança, dificuldade de enfrentamento das demandas e desengajamento.',
  'RPS-005': 'Redução da percepção de controle, desmotivação, estresse e menor capacidade de adaptação às demandas do trabalho.',
};

function linha(code: string, label: string, dim: keyof typeof DIM | null, exp: number, p: number, s: number, alta = 0): PsychosocialRiskMatrixRow {
  const risk = p * s;
  const riskClass = psychosocialRiskClass(risk);
  return {
    slug: code.toLowerCase(),
    label,
    code,
    dimensionLabel: dim ? DIM[dim] : null,
    exposureAvg: exp,
    exposureCount: 19,
    highExposureCount: alta,
    probability: p,
    severity: s,
    risk,
    riskClass,
    planRequired: PSYCHOSOCIAL_RISK_PLAN_REQUIRED[riskClass],
    consequences: AGRAVOS[code] ?? null,
    criticalCount: 0,
    respondents: 19,
    percentCritical: 0,
    actionLabel: '',
  };
}
/** Matriz como o motor devolve: R decrescente, empate pela ordem do catálogo. */
const porRisco = (rows: PsychosocialRiskMatrixRow[]) => [...rows].sort((a, b) => b.risk - a.risk);
const GERAL = porRisco(ANEXO.map(([c, l, d, e, p, s]) => linha(c, l, d, e, p, s, ALTA[c] ?? 0)));

const GHE = {
  rh: porRisco([
    linha('RPS-001', 'Sobrecarga de trabalho', 'd1', 3.57, 4, 4),
    linha('RPS-003', 'Demandas simultâneas e interrupções recorrentes', 'd1', 3.57, 4, 3),
    linha('RPS-005', 'Baixa autonomia', 'd2', 3.43, 3, 2),
    linha('RPS-018', 'Falta de suporte gerencial', 'd5', 3.57, 4, 3),
  ]),
  fin: porRisco([
    linha('RPS-001', 'Sobrecarga de trabalho', 'd1', 3.5, 4, 4),
    linha('RPS-003', 'Demandas simultâneas e interrupções recorrentes', 'd1', 3.5, 4, 3),
    linha('RPS-005', 'Baixa autonomia', 'd2', 4.0, 5, 2),
    linha('RPS-018', 'Falta de suporte gerencial', 'd5', 3.5, 4, 3),
  ]),
  op: porRisco([
    linha('RPS-001', 'Sobrecarga de trabalho', 'd1', 3.67, 5, 4),
    linha('RPS-003', 'Demandas simultâneas e interrupções recorrentes', 'd1', 3.67, 5, 3),
    linha('RPS-005', 'Baixa autonomia', 'd2', 4.0, 5, 2),
    linha('RPS-018', 'Falta de suporte gerencial', 'd5', 3.67, 5, 3),
  ]),
};

// Plano de ação aprovado (págs. 6, 7 e 13). Prazos ao meio-dia local, como o
// portal grava. Criadas FORA de ordem de propósito: a numeração PA segue a
// prioridade do fator, não a ordem de criação.
const meioDia = (d: string) => new Date(`${d}T15:00:00.000Z`);
const ACOES = {
  pa5: {
    point: 'Sobrecarga de trabalho', riskFactorSlug: 'rps-001', scopeGhe: 'GHE-Operações',
    action: 'Rebalancear capacidade e cobertura do GHE-Operações nos períodos de pico, com definição de cobertura mínima e redistribuição de atividades.',
    objective: 'Reduzir a exposição elevada à sobrecarga identificada no GHE-Operações.',
    responsible: 'Gerente de Operações', dueDate: meioDia('2026-10-23'),
    indicator: 'Horas extras, backlog, cobertura mínima e exposição média do fator no acompanhamento do grupo.',
    expectedEvidence: 'Mapa de capacidade do GHE, escala/cobertura revisada e registro de monitoramento por quatro semanas.',
  },
  pa4: {
    point: 'Baixa autonomia', riskFactorSlug: 'rps-005', scopeGhe: null,
    action: 'Formalizar alçadas de decisão para situações recorrentes, definindo o que a equipe decide e o que deve ser escalado.',
    objective: 'Aumentar autonomia com clareza de limites, reduzindo centralização e retrabalho decisório.',
    responsible: 'Diretoria Administrativa + Gestores', dueDate: meioDia('2026-11-23'),
    indicator: 'Tempo de aprovação, decisões tomadas dentro da alçada e volume de escalonamentos.',
    expectedEvidence: 'Matriz de alçadas aprovada e comunicada às áreas abrangidas.',
  },
  pa2: {
    point: 'Demandas simultâneas e interrupções recorrentes', riskFactorSlug: 'rps-003', scopeGhe: null,
    action: 'Instituir rotina semanal de priorização, com critérios de urgência, interrupção e escalonamento.',
    objective: 'Reduzir simultaneidade de demandas, conflitos de prioridade e interrupções evitáveis.',
    responsible: 'Coordenadores / Gestores', dueDate: meioDia('2026-10-24'),
    indicator: 'Aderência ao ritual, pendências críticas e ocorrências de repriorização emergencial.',
    expectedEvidence: 'Registro semanal de prioridades, pauta/ata do ritual e critérios de escalonamento publicados.',
  },
  pa1: {
    point: 'Sobrecarga de trabalho', riskFactorSlug: 'rps-001', scopeGhe: null,
    action: 'Instituir revisão mensal de capacidade e distribuição de carga por área/GHE, com tratamento dos períodos de pico.',
    objective: 'Reduzir sobrecarga recorrente e antecipar desequilíbrios entre demanda e capacidade.',
    responsible: 'RH + Gestores', dueDate: meioDia('2026-11-22'),
    indicator: 'Horas extras, backlog, volume demanda/capacidade e recorrência de picos.',
    expectedEvidence: 'Registro mensal de capacidade, decisões de redistribuição e acompanhamento dos indicadores.',
  },
  pa3: {
    point: 'Falta de suporte gerencial', riskFactorSlug: 'rps-018', scopeGhe: null,
    action: 'Padronizar fluxo de suporte da liderança e escalonamento de impedimentos operacionais.',
    objective: 'Aumentar disponibilidade e previsibilidade do suporte gerencial em situações críticas.',
    responsible: 'RH + Gestores', dueDate: meioDia('2026-12-22'),
    indicator: 'Tempo de resposta, volume de escalonamentos e percepção de apoio no acompanhamento do ciclo.',
    expectedEvidence: 'Fluxo de suporte validado, responsáveis definidos e registros de escalonamento.',
  },
} satisfies Record<string, AcaoPlano>;
const APROVADAS: AcaoPlano[] = [ACOES.pa5, ACOES.pa4, ACOES.pa2, ACOES.pa1, ACOES.pa3];

const ORDEM_GHES = ['GHE-Recursos Humanos', 'GHE-Financeiro', 'GHE-Operações'];
const MATRIZ_GHE: Record<string, PsychosocialRiskMatrixRow[]> = {
  'GHE-Recursos Humanos': GHE.rh,
  'GHE-Financeiro': GHE.fin,
  'GHE-Operações': GHE.op,
};
const codigoDe = (slug: string) => slug.toUpperCase();
const numerar = () =>
  numerarAcoes(APROVADAS, GERAL, ORDEM_GHES, (g) => MATRIZ_GHE[g] ?? [], codigoDe);

describe('peças do modelo oficial (funções puras)', () => {
  it('numera PA-001…PA-005: gerais pela prioridade do Resultado Geral, depois a do GHE', () => {
    expect(numerar().map(tituloDaAcao)).toEqual([
      'PA-001 - Resultado Geral da Organização - RPS-001 - Sobrecarga de trabalho',
      'PA-002 - Resultado Geral da Organização - RPS-003 - Demandas simultâneas e interrupções recorrentes',
      'PA-003 - Resultado Geral da Organização - RPS-018 - Falta de suporte gerencial',
      'PA-004 - Resultado Geral da Organização - RPS-005 - Baixa autonomia',
      'PA-005 - GHE - Operações - RPS-001 - Sobrecarga de trabalho',
    ]);
  });

  it('panorama dos GHEs igual ao da pág. 4', () => {
    const t = tabelaPanorama(
      { n: 19, score: 72.3, faixa: 'Em estruturação', matriz: GERAL },
      [
        { ghe: 'GHE-Recursos Humanos', n: 7, score: 72.2, faixa: 'Em estruturação', matriz: GHE.rh },
        { ghe: 'GHE-Financeiro', n: 6, score: 72.8, faixa: 'Em estruturação', matriz: GHE.fin },
        { ghe: 'GHE-Operações', n: 6, score: 72.0, faixa: 'Em estruturação', matriz: GHE.op },
      ],
      numerar(),
      1,
    );
    expect(t.columns).toEqual(['Escopo / GHE', 'n', 'Score', 'Faixa', 'Fatores R >= 10', 'Maior R', 'Ações específicas']);
    expect(t.data).toEqual([
      ['Resultado Geral da Organização', '19', '72,3', 'Em estruturação', '4', '16', '4 ações gerais'],
      ['Recursos Humanos', '7', '72,2', 'Em estruturação', '3', '16', '0'],
      ['Financeiro', '6', '72,8', 'Em estruturação', '4', '16', '0'],
      ['Operações', '6', '72,0', 'Em estruturação', '4', '20', '1'],
    ]);
  });

  it('card da ação com os campos do modelo final, sem evidência esperada, escapando o texto', () => {
    const [pa1] = numerar();
    const html = cardAcaoHtml(pa1);
    expect(html).toContain('PA-001 - Resultado Geral da Organização - RPS-001 - Sobrecarga de trabalho');
    expect(html).toContain('>Medida: Instituir revisão mensal de capacidade');
    expect(html).toContain('>Objetivo: Reduzir sobrecarga recorrente');
    expect(html).toContain('>Responsável: RH + Gestores<');
    expect(html).toContain('>Prazo: 22/11/2026<');
    expect(html).toContain('>Acompanhamento: Horas extras, backlog, volume demanda/capacidade e recorrência de picos.<');
    // Evidência é acompanhada no Plano, não no documento emitido.
    expect(html).not.toContain('Evidência');
    expect(html).not.toContain('Responsável da empresa');
    const perigoso = cardAcaoHtml({ ...pa1, acao: { ...pa1.acao, action: '<script>x</script>' } });
    expect(perigoso).not.toContain('<script>');
  });

  it('CNPJ no formato do modelo e participação só com convite que cubra as respostas', () => {
    expect(cnpjFormatado('54924959000142')).toBe('54.924.959/0001-42');
    expect(cnpjFormatado('54.924.959/0001-42')).toBe('54.924.959/0001-42');
    expect(cnpjFormatado('123')).toBe('123');
    expect(cnpjFormatado(null)).toBe('—');
    expect(participacaoDoCiclo(19, 19)).toEqual({ convidados: 19, taxa: '100,0%' });
    expect(participacaoDoCiclo(30, 19)).toEqual({ convidados: 30, taxa: '63,3%' });
    // Sem convite, ou resposta por link público além dos convidados: não sai.
    expect(participacaoDoCiclo(0, 19)).toBeNull();
    expect(participacaoDoCiclo(10, 19)).toBeNull();
  });

  it('leitura do grupo: sem específica, "as medidas gerais abrangem"; com uma, "além das medidas gerais"', () => {
    const n = numerar();
    const fatores = (m: PsychosocialRiskMatrixRow[]) =>
      m.filter((r) => r.planRequired).sort((a, b) => codigoDe(a.slug).localeCompare(codigoDe(b.slug)));
    const gerais = (m: PsychosocialRiskMatrixRow[]) =>
      n.filter((a) => !a.ghe && fatores(m).some((f) => f.slug === a.fatorSlug));
    expect(leituraDoGhe(fatores(GHE.fin), gerais(GHE.fin), [])).toBe(
      'Sobrecarga de trabalho (R=16), Demandas simultâneas e interrupções recorrentes (R=12), ' +
        'Baixa autonomia (R=10) e Falta de suporte gerencial (R=12) requerem ação. ' +
        'As medidas gerais aprovadas abrangem este grupo.',
    );
    expect(leituraDoGhe(fatores(GHE.op), gerais(GHE.op), n.filter((a) => a.ghe === 'GHE-Operações'))).toBe(
      'Sobrecarga de trabalho (R=20), Demandas simultâneas e interrupções recorrentes (R=15), ' +
        'Baixa autonomia (R=10) e Falta de suporte gerencial (R=15) requerem ação. ' +
        'Além das medidas gerais, há uma ação específica aprovada para o grupo.',
    );
    // Fator do GHE sem nenhuma ação aplicável é dito — a pré-visualização não finge cobertura.
    expect(leituraDoGhe(fatores(GHE.fin), [], [])).toContain(
      'Sem ação aprovada aplicável: Sobrecarga de trabalho, Demandas simultâneas e interrupções recorrentes, Baixa autonomia e Falta de suporte gerencial.',
    );
  });
});

// ── O documento inteiro, montado pelo gerador ─────────────────────────────────

const BANDAS = [
  { code: 'ATENCAO_CRITICA', label: 'Atenção crítica', min: 0, max: 49, color: '#c75b4e' },
  { code: 'VULNERAVEL', label: 'Vulnerável', min: 50, max: 64, color: '#d9903d' },
  { code: 'EM_ESTRUTURACAO', label: 'Em estruturação', min: 65, max: 79, color: '#d6b44c' },
  { code: 'ESTRUTURADO', label: 'Estruturado', min: 80, max: 100, color: '#5e8b68' },
];
const DIMENSOES = [55.3, 62.2, 79.6, 77.3, 63.8, 77.3, 76.0, 77.3, 77.3, 77.3];

async function gerarDossie(): Promise<GeneratedDocument> {
  const tx = { devolutivaRecord: { findMany: vi.fn(async () => []) } };
  const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: typeof tx) => unknown) => fn(tx)), admin: {} };
  const gheRes = (ghe: string, n: number, score: number, riskMatrix: PsychosocialRiskMatrixRow[]) => ({
    ghe, respondents: n, suppressed: false, score, levelLabel: 'Em estruturação', riskMatrix,
  });
  const psychosocial = {
    results: vi.fn(async () => ({
      totalRespondents: 19,
      minRespondents: 5,
      overall: { suppressed: false, riskMatrix: GERAL },
      ghes: [
        gheRes('GHE-Recursos Humanos', 7, 72.2, GHE.rh),
        gheRes('GHE-Financeiro', 6, 72.8, GHE.fin),
        gheRes('GHE-Operações', 6, 72.0, GHE.op),
      ],
    })),
  };
  const svc = new DocumentsService(prisma as never, psychosocial as never, {} as never);
  const priv = svc as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  // Leituras privadas do serviço trocadas pelos números do modelo.
  const espiar = (nome: string, valor: unknown) => vi.spyOn(priv, nome).mockResolvedValue(valor);
  espiar('instrumentoDoTenant', { slug: 'diagnostico-organizacional', motorPsicossocial: true });
  espiar('psychosocialSummary', {
    suppressed: false,
    totalRespondents: 19,
    minRespondents: 5,
    period: '23/09/2026 a 23/09/2026',
    score: 72.3,
    decimals: 1,
    levelLabel: 'Em estruturação',
    byDimension: DIMENSOES.map((value, i) => ({ slug: `d${i + 1}`, label: Object.values(DIM)[i], value })),
    bands: BANDAS,
    sectorsList: [],
    sectors: [],
    groupBy: 'ghe',
  });
  espiar('approvedTextsOf', {});
  espiar('sectorAdhesion', { minRespondents: 5, total: 19, sectors: [] });
  espiar('activeVersionLabel', 'CRIVO NR-1 v2.0');
  espiar('convidadosDoCiclo', 19);

  const generate = (priv.generateDossieTecnico as unknown as (t: string, c: unknown) => Promise<GeneratedDocument>).bind(svc);
  return generate('org-ouro', {
    company: 'ORGANIZACIONAL TESTE 23 09 2026',
    org: { legalName: 'O2 LEGACY', taxId: '54924959000142' },
    contract: { technicalOutput: 'SEM_INTEGRACAO', responsible: 'RH' },
    method: 'ORGANIZACIONAL',
    plans: [
      {
        title: 'Plano de Evolução',
        validatedAt: new Date('2026-09-23T15:00:00Z'),
        validatedBy: 'RH',
        items: APROVADAS.map((a) => ({
          ...a, status: 'APROVADA', origin: 'questionário', exposedGroup: null, severity: null,
          probability: null, riskLevel: null, evidences: [],
        })),
      },
    ],
    cnaeDecision: null,
  });
}

const secao = (doc: GeneratedDocument, heading: string, n = 0) =>
  doc.sections.filter((s) => s.heading === heading)[n];

describe('Dossiê Organizacional montado — igual ao modelo final de 25/09', () => {
  it('cabeçalho: subtítulo e os 8 campos do modelo, em pares', async () => {
    const doc = await gerarDossie();
    expect(doc.subtitle).toBe('Documento técnico de apoio à gestão preventiva');
    const visiveis = doc.meta.filter((m) => m.value !== '—').map((m) => m.label);
    expect(visiveis).toEqual([
      'Organização', 'CNPJ', 'Método aplicado', 'Respostas válidas',
      'Período avaliado', 'Data de emissão', 'Versão metodológica', 'Status',
    ]);
    const valor = (l: string) => doc.meta.find((m) => m.label === l)?.value;
    expect(valor('CNPJ')).toBe('54.924.959/0001-42');
    expect(valor('Método aplicado')).toBe('Diagnóstico Organizacional CRIVO');
    expect(valor('Respostas válidas')).toBe('19');
    expect(valor('Versão metodológica')).toBe('CRIVO NR-1 v2.0');
    expect(valor('Data de emissão')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('seções na ordem do modelo (14 páginas, anexo em 4 partes e um bloco por GHE)', async () => {
    const doc = await gerarDossie();
    const ghe = (nome: string) => [
      `Anexo técnico - GHE - ${nome}`,
      'Leitura técnica do grupo exposto',
      'Fatores que requerem ação',
      'Ações gerais aplicáveis a este GHE',
      'Ações específicas aprovadas para este GHE',
    ];
    expect(doc.sections.map((s) => s.heading)).toEqual([
      'Objetivo e escopo', 'Responsabilidades', 'Escopo da avaliação',
      'Metodologia e critérios', 'Método de avaliação', 'Matriz de risco 5 x 5', '', 'Critérios expressos',
      'Síntese do ciclo', 'Síntese executiva', 'Resultados por dimensão', 'Prioridades técnicas - Resultado Geral',
      'Resultado Geral e panorama dos GHEs', '', 'Leitura por grupo', '',
      'Inventário técnico', 'Caracterização dos fatores prioritários - Resultado Geral', '', '',
      'Plano, registros e responsabilidade', 'Plano de ação aprovado - Resultado Geral da Organização',
      'Medidas existentes validadas',
      'Controle documental', 'Responsabilidade', 'Estado do documento e acompanhamento',
      'Referências técnicas e metodológicas', '',
      'Anexo técnico - fatores classificados', 'Resultado consolidado do ciclo - parte 1',
      'Anexo técnico - fatores classificados', 'Resultado consolidado do ciclo - parte 2',
      'Anexo técnico - fatores classificados', 'Resultado consolidado do ciclo - parte 3',
      'Anexo técnico - fatores classificados', 'Resultado consolidado do ciclo - parte 4',
      ...ghe('Recursos Humanos'), ...ghe('Financeiro'), ...ghe('Operações'),
    ]);
  });

  it('página 1: textos do modelo e recortes "GHE - X" separados por ";"', async () => {
    const doc = await gerarDossie();
    expect(secao(doc, 'Objetivo e escopo').body).toBe(
      'Este dossiê consolida os fatores de riscos psicossociais relacionados ao trabalho identificados ' +
        'no ciclo, apresenta os resultados e prioridades técnicas e registra as medidas aprovadas pela ' +
        'organização para prevenção e acompanhamento.\n\n' +
        'Os resultados podem apoiar a Avaliação Ergonômica Preliminar (AEP) e a atualização do Programa ' +
        'de Gerenciamento de Riscos (PGR), quando aplicável. O documento trata exclusivamente das ' +
        'condições, da organização e da gestão do trabalho; não substitui a AEP, o PGR ou a validação da ' +
        'organização e não realiza diagnóstico clínico ou psicológico individual.',
    );
    expect(secao(doc, 'Responsabilidades').rows).toEqual([
      {
        label: 'CRIVO',
        value:
          'Aplica o Método CRIVO vigente, processa as respostas conforme as regras registradas para o ' +
          'ciclo e gera este dossiê técnico.',
      },
      {
        label: 'Organização',
        value:
          'Confirma as informações de contexto, aprova e implementa as medidas, define responsáveis e ' +
          'prazos, acompanha os resultados e mantém atualizados seus documentos de Segurança e Saúde no ' +
          'Trabalho (SST).',
      },
    ]);
    expect(secao(doc, 'Escopo da avaliação').rows).toEqual([
      { label: 'Convidados', value: '19' },
      { label: 'Respostas válidas', value: '19' },
      { label: 'Taxa de participação', value: '100,0%' },
      { label: 'Estrutura considerada', value: 'Organização e GHEs (Grupos de Exposição) cadastrados no ciclo' },
      { label: 'Recortes exibidos', value: 'GHE - Recursos Humanos; GHE - Financeiro; GHE - Operações' },
      {
        label: 'Confidencialidade',
        value:
          'Recortes estatísticos somente quando atingido o mínimo de 5 respostas válidas. Respostas ' +
          'individuais e recortes abaixo do mínimo não são exibidos.',
      },
    ]);
  });

  it('página 2: pontuação do modelo (hífen e "x") e matriz com "1 fator"/"N fatores"', async () => {
    const doc = await gerarDossie();
    const rows = doc.sections.find((s) => s.rows?.[0]?.label === 'Probabilidade (1-5)')!.rows!;
    expect(rows.map((r) => r.label)).toEqual(['Probabilidade (1-5)', 'Severidade (1-5)', 'Risco = P x S']);
    expect(rows[0].value).toContain('Exposição = 6 - resposta. Faixas: 1,00-1,49 = 1;');
    expect(rows[2].value).toBe(
      '1-4 Baixo / Tolerável · 5-9 Moderado / Atenção pontual · 10-15 Alto / Requer plano de ação · ' +
        '16-20 Muito alto / Prioridade imediata · 21-25 Crítico / Intolerável.',
    );
    const matriz = secao(doc, 'Matriz de risco 5 x 5').html!;
    expect(matriz).toContain('>1 fator<');
    expect(matriz).toContain('>21 fatores<');
    expect(matriz).toContain('>9 fatores<');
    expect(matriz).not.toContain('fator(es)');
  });

  it('página 3: síntese com negrito, vírgula decimal e 79,6 Estruturado na cor dele', async () => {
    const doc = await gerarDossie();
    expect(secao(doc, 'Síntese executiva').html).toBe(
      '<p>O ciclo apresenta score executivo geral de <strong>72,3 (Em estruturação)</strong>. A priorização ' +
        'técnica identifica <strong>Sobrecarga de trabalho</strong>, <strong>Demandas simultâneas e ' +
        'interrupções recorrentes</strong>, <strong>Falta de suporte gerencial</strong> e <strong>Baixa ' +
        'autonomia</strong> como fatores que requerem plano de ação pela metodologia CRIVO. O score ' +
        'executivo e a classificação técnica de risco são leituras distintas.</p>',
    );
    const barras = secao(doc, 'Resultados por dimensão').html!;
    expect(barras).toContain('>79,6<');
    expect(barras).toMatch(/background:#5e8b68;height:6pt;border-radius:6px;width:79\.6%/);
    expect(secao(doc, 'Prioridades técnicas - Resultado Geral').table?.data).toEqual([
      ['Sobrecarga de trabalho', '4', '4', '16', 'Muito alto / Prioridade imediata'],
      ['Demandas simultâneas e interrupções recorrentes', '4', '3', '12', 'Alto / Requer plano de ação'],
      ['Falta de suporte gerencial', '4', '3', '12', 'Alto / Requer plano de ação'],
      ['Baixa autonomia', '5', '2', '10', 'Alto / Requer plano de ação'],
    ]);
  });

  it('página 4: panorama e leitura por grupo', async () => {
    const doc = await gerarDossie();
    const panorama = doc.sections[doc.sections.findIndex((s) => s.heading === 'Resultado Geral e panorama dos GHEs') + 1];
    expect(panorama.table?.data[0]).toEqual(['Resultado Geral da Organização', '19', '72,3', 'Em estruturação', '4', '16', '4 ações gerais']);
    expect(panorama.table?.data[3]).toEqual(['Operações', '6', '72,0', 'Em estruturação', '4', '20', '1']);
    const nota = doc.sections[doc.sections.findIndex((s) => s.heading === 'Leitura por grupo') + 1];
    expect(nota.nota).toBe(true);
    expect(nota.body).toBe(
      'O detalhamento técnico de cada GHE e as ações aplicáveis aparecem no Anexo Técnico por GHE, ' +
        'mantendo o corpo principal objetivo mesmo quando a organização possuir muitos grupos expostos.',
    );
    const leitura = secao(doc, 'Leitura por grupo').table!;
    expect(leitura.columns).toEqual(['GHE', 'Leitura técnica do ciclo']);
    expect(leitura.data.map((r) => r[0])).toEqual(['Recursos Humanos', 'Financeiro', 'Operações']);
    expect(leitura.data[0][1]).toBe(
      'Sobrecarga de trabalho (R=16), Demandas simultâneas e interrupções recorrentes (R=12) e Falta de ' +
        'suporte gerencial (R=12) requerem ação. As medidas gerais aprovadas abrangem este grupo.',
    );
  });

  it('página 5: inventário com vírgula decimal', async () => {
    const doc = await gerarDossie();
    const carac = secao(doc, 'Caracterização dos fatores prioritários - Resultado Geral').table!.data;
    expect(carac[0]).toEqual([
      'RPS-001', 'Demandas e Ritmo de Trabalho', 'Sobrecarga de trabalho',
      'Exposição média 3,58; 57,9% das respostas válidas do fator em exposição alta (respostas 1 ou 2).',
    ]);
    expect(carac[3][3]).toBe(
      'Exposição média 3,84; 78,9% das respostas válidas do fator em exposição alta (respostas 1 ou 2).',
    );
  });

  it('página 6: 4 cards gerais (a do GHE não se repete aqui) e medidas existentes', async () => {
    const doc = await gerarDossie();
    const plano = secao(doc, 'Plano de ação aprovado - Resultado Geral da Organização');
    expect(plano.body).toBe(
      'As medidas abaixo correspondem às ações aprovadas pela organização para os fatores prioritários ' +
        'do Resultado Geral. O Dossiê registra o estado validado no momento da emissão. O ' +
        'acompanhamento posterior ocorre no Plano de Evolução.',
    );
    expect(plano.html).not.toContain('Evidência esperada');
    expect(doc.sections.some((s) => s.heading === 'Evidências')).toBe(false);
    const titulos = [...plano.html!.matchAll(/PA-\d{3} - [^<]+/g)].map((m) => m[0]);
    expect(titulos).toEqual([
      'PA-001 - Resultado Geral da Organização - RPS-001 - Sobrecarga de trabalho',
      'PA-002 - Resultado Geral da Organização - RPS-003 - Demandas simultâneas e interrupções recorrentes',
      'PA-003 - Resultado Geral da Organização - RPS-018 - Falta de suporte gerencial',
      'PA-004 - Resultado Geral da Organização - RPS-005 - Baixa autonomia',
    ]);
    expect(secao(doc, 'Medidas existentes validadas').table).toEqual({
      columns: ['Fator', 'Medida existente validada'],
      data: [[
        'Fatores prioritários do ciclo',
        'Não foram registradas medidas existentes validadas para os fatores prioritários deste ciclo.',
      ]],
    });
  });

  it('página 7: controle documental abre página; responsabilidade, estado e referências do modelo', async () => {
    const doc = await gerarDossie();
    const controle = secao(doc, 'Controle documental');
    expect(controle.novaPagina).toBe(true);
    expect(controle.rows).toEqual(expect.arrayContaining([
      { label: 'Validação', value: 'Organização / responsável autorizado' },
      { label: 'Método', value: 'CRIVO NR-1 v2.0' },
      { label: 'Organização', value: 'O2 LEGACY' },
    ]));
    expect(secao(doc, 'Responsabilidade').body).toContain(
      'A organização contratante valida o contexto, os responsáveis e as ações, implementa as medidas ' +
        'aprovadas e realiza as integrações com seus documentos de Segurança e Saúde no Trabalho quando ' +
        'aplicáveis.',
    );
    expect(secao(doc, 'Estado do documento e acompanhamento').body).toBe(
      'Este Dossiê registra o estado validado no momento da emissão e permanece inalterado. O ' +
        'acompanhamento posterior das ações ocorre no Plano de Evolução e pode ser documentado por meio ' +
        'do Extrato do Plano de Ação Preventivo, sem alterar retroativamente este documento.',
    );
    expect(secao(doc, 'Referências técnicas e metodológicas').body).toBe(
      'NR-1 - Disposições Gerais e Gerenciamento de Riscos Ocupacionais; NR-17 - Ergonomia; Guia de ' +
        'Informações sobre os Fatores de Riscos Psicossociais Relacionados ao Trabalho - Ministério do ' +
        'Trabalho e Emprego; Manual de Interpretação e Aplicação do Capítulo 1.5 da NR-1 - Gerenciamento ' +
        'de Riscos Ocupacionais (GRO) - Ministério do Trabalho e Emprego; COPSOQ / Copenhagen ' +
        'Psychosocial Questionnaire; HSE Management Standards.',
    );
    const autoral = doc.sections[doc.sections.findIndex((s) => s.heading === 'Referências técnicas e metodológicas') + 1];
    expect(autoral).toEqual({
      heading: '',
      nota: true,
      body:
        'O instrumento CRIVO é autoral. As referências acima subsidiam a estrutura metodológica e não ' +
        'significam aplicação integral de instrumentos de terceiros.',
    });
  });

  it('páginas 8 a 11: 40 fatores em quatro partes de 10, na ordem do código', async () => {
    const doc = await gerarDossie();
    const parte = (n: number) => secao(doc, `Resultado consolidado do ciclo - parte ${n}`).table!;
    expect(parte(1).columns).toEqual(['ID', 'Fator', 'Dimensão relacionada', 'Exposição', 'P', 'S', 'R', 'Classificação']);
    expect([1, 2, 3, 4].map((n) => parte(n).data.length)).toEqual([10, 10, 10, 10]);
    expect(parte(1).data[0]).toEqual(['RPS-001', 'Sobrecarga de trabalho', 'Demandas e Ritmo de Trabalho', '3,58', '4', '4', '16', 'Muito alto / Prioridade imediata']);
    expect(parte(1).data[9][0]).toBe('RPS-010');
    expect(parte(2).data[0][0]).toBe('RPS-011');
    expect(parte(3).data[0]).toEqual(['RPS-021', 'Falta de apoio social no trabalho', 'Relações, Respeito e Segurança Psicológica', '1,63', '2', '3', '6', 'Moderado / Atenção pontual']);
    expect(parte(4).data[9][0]).toBe('RPS-040');
  });

  // Conferência VISUAL contra o PDF: `DOSSIE_OURO_JSON=<arquivo> npx vitest run
  // dossie-organizacional` grava o documento montado; o renderDocumentHtml do
  // portal + "Salvar como PDF" dão as páginas para pôr lado a lado com o modelo.
  it('grava o documento para conferência visual quando DOSSIE_OURO_JSON aponta um arquivo', async () => {
    const destino = process.env.DOSSIE_OURO_JSON;
    if (!destino) return;
    const { writeFileSync } = await import('node:fs');
    writeFileSync(destino, JSON.stringify(await gerarDossie(), null, 2));
  });

  it('páginas 12 a 14: bloco de cada GHE com os fatores DELE e as ações aplicáveis', async () => {
    const doc = await gerarDossie();
    const bloco = (nome: string) => {
      const i = doc.sections.findIndex((s) => s.heading === `Anexo técnico - GHE - ${nome}`);
      return doc.sections.slice(i + 1, i + 5);
    };
    const [leituraRh, fatoresRh, geraisRh, especRh] = bloco('Recursos Humanos');
    expect(leituraRh.rows).toEqual([
      { label: 'Respondentes', value: '7' },
      { label: 'Score executivo', value: '72,2 (Em estruturação)' },
      { label: 'Fatores com R >= 10', value: '3' },
      { label: 'Maior risco técnico', value: '16' },
    ]);
    // Na ordem do código; só o R pintado com a cor da classe (modelo final).
    expect([...fatoresRh.html!.matchAll(/<td>(RPS-\d{3})<\/td>/g)].map((m) => m[1])).toEqual(['RPS-001', 'RPS-003', 'RPS-018']);
    expect(fatoresRh.html).toContain('<td>3,57</td>');
    expect(fatoresRh.html).toContain('<td style="background:#E74B3B;font-weight:700">16</td>');
    expect(fatoresRh.html).toContain('<td>Alto / Requer plano de ação</td>');
    // RH não tem Baixa autonomia com R >= 10: a PA-004 não vale para o grupo.
    expect(geraisRh.table?.columns).toEqual(['ID', 'Fator', 'Medida aprovada', 'Responsável', 'Prazo']);
    expect(geraisRh.table?.data.map((r) => r[0])).toEqual(['PA-001', 'PA-002', 'PA-003']);
    expect(geraisRh.table?.data[1]).toEqual([
      'PA-002', 'Demandas simultâneas e interrupções recorrentes',
      'Instituir rotina semanal de priorização, com critérios de urgência, interrupção e escalonamento.',
      'Coordenadores / Gestores', '24/10/2026',
    ]);
    expect(especRh.rows).toEqual([{
      label: 'Situação',
      value:
        'Não há ação específica aprovada para este GHE neste ciclo. O grupo permanece abrangido pelas ' +
        'ações gerais acima, conforme os fatores técnicos calculados para o próprio GHE.',
    }]);

    const [, fatoresFin, geraisFin] = bloco('Financeiro');
    expect([...fatoresFin.html!.matchAll(/<td>(RPS-\d{3})<\/td>/g)].map((m) => m[1])).toEqual(['RPS-001', 'RPS-003', 'RPS-005', 'RPS-018']);
    expect(geraisFin.table?.data.map((r) => r[0])).toEqual(['PA-001', 'PA-002', 'PA-003', 'PA-004']);

    const [leituraOp, , geraisOp, especOp] = bloco('Operações');
    expect(leituraOp.rows?.[3]).toEqual({ label: 'Maior risco técnico', value: '20' });
    expect(geraisOp.table?.data.map((r) => r[0])).toEqual(['PA-001', 'PA-002', 'PA-003', 'PA-004']);
    expect(especOp.html).toContain('PA-005 - GHE - Operações - RPS-001 - Sobrecarga de trabalho');
    expect(especOp.html).toContain('>Responsável: Gerente de Operações<');
    expect(especOp.html).toContain('>Prazo: 23/10/2026<');
    expect(especOp.html).not.toContain('Evidência');
  });
});

describe('revisão 24/09 — datas e síntese', () => {
  it('prazo digitado (meia-noite UTC) sai no MESMO dia; instante sai no fuso de Brasília', async () => {
    const { dataPtBr } = await import('./dossie-organizacional');
    expect(dataPtBr(new Date('2026-10-23'))).toBe('23/10/2026');
    expect(dataPtBr(new Date('2026-10-23T15:00:00.000Z'))).toBe('23/10/2026');
    // 23h34 em Brasília do dia 23 = 02h34 UTC do dia 24: a emissão é do dia 23.
    expect(dataPtBr(new Date('2026-09-24T02:34:12.731Z'))).toBe('23/09/2026');
    expect(dataPtBr(null)).toBe('—');
  });

  it('síntese não diz "nenhum fator" quando só a matriz de um GHE tem R >= 10', async () => {
    const { sinteseExecutivaHtml } = await import('./dossie-organizacional');
    const html = sinteseExecutivaHtml('76,4', 'Em estruturação', [], ['Baixa autonomia (GHE - Operações)']);
    expect(html).toContain('No Resultado Geral, a priorização técnica não identificou fatores');
    expect(html).toContain('Nos GHEs, <strong>Baixa autonomia (GHE - Operações)</strong> requer ação no próprio grupo.');
    expect(sinteseExecutivaHtml('76,4', 'Em estruturação', [])).toContain(
      'A priorização técnica não identificou fatores que requeiram plano de ação pela metodologia CRIVO.',
    );
  });
});
