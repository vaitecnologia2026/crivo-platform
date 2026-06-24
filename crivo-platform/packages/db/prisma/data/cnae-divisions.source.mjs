// ─────────────────────────────────────────────────────────────────────────────
// FONTE ÚNICA das 87 divisões da CNAE 2.0 + classificação PRELIMINAR de risco.
// Gera dois artefatos (rode: `node packages/db/prisma/data/cnae-divisions.source.mjs`):
//   1) a migração SQL (CREATE TYPE/TABLE + INSERT das 87 divisões) — produção;
//   2) `cnae-divisions.ts` (array tipado) — seed/dev/testes/referência.
//
// A classificação de risco segue a lista fornecida no escopo (editável depois pelo
// admin na tabela cnae_division_rules). NÃO é verdade jurídica: é "classificação
// preliminar técnica", sujeita a revisão por especialista.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// [code, nome oficial, seção CNAE 2.0, risco preliminar]
const BASE = [
  ['01', 'Agricultura, pecuária e serviços relacionados', 'A', 'ALTO'],
  ['02', 'Produção florestal', 'A', 'ALTO'],
  ['03', 'Pesca e aquicultura', 'A', 'ALTO'],
  ['05', 'Extração de carvão mineral', 'B', 'ALTO'],
  ['06', 'Extração de petróleo e gás natural', 'B', 'ALTO'],
  ['07', 'Extração de minerais metálicos', 'B', 'ALTO'],
  ['08', 'Extração de minerais não-metálicos', 'B', 'ALTO'],
  ['09', 'Atividades de apoio à extração de minerais', 'B', 'ALTO'],
  ['10', 'Fabricação de produtos alimentícios', 'C', 'ALTO'],
  ['11', 'Fabricação de bebidas', 'C', 'ALTO'],
  ['12', 'Fabricação de produtos do fumo', 'C', 'ALTO'],
  ['13', 'Fabricação de produtos têxteis', 'C', 'MEDIO_ALTO'],
  ['14', 'Confecção de artigos do vestuário e acessórios', 'C', 'MEDIO'],
  ['15', 'Preparação de couros e fabricação de artefatos de couro, artigos para viagem e calçados', 'C', 'MEDIO_ALTO'],
  ['16', 'Fabricação de produtos de madeira', 'C', 'ALTO'],
  ['17', 'Fabricação de celulose, papel e produtos de papel', 'C', 'ALTO'],
  ['18', 'Impressão e reprodução de gravações', 'C', 'MEDIO'],
  ['19', 'Fabricação de coque, de produtos derivados do petróleo e de biocombustíveis', 'C', 'ALTO'],
  ['20', 'Fabricação de produtos químicos', 'C', 'ALTO'],
  ['21', 'Fabricação de produtos farmoquímicos e farmacêuticos', 'C', 'ALTO'],
  ['22', 'Fabricação de produtos de borracha e de material plástico', 'C', 'ALTO'],
  ['23', 'Fabricação de produtos de minerais não-metálicos', 'C', 'ALTO'],
  ['24', 'Metalurgia', 'C', 'ALTO'],
  ['25', 'Fabricação de produtos de metal, exceto máquinas e equipamentos', 'C', 'ALTO'],
  ['26', 'Fabricação de equipamentos de informática, produtos eletrônicos e ópticos', 'C', 'MEDIO'],
  ['27', 'Fabricação de máquinas, aparelhos e materiais elétricos', 'C', 'ALTO'],
  ['28', 'Fabricação de máquinas e equipamentos', 'C', 'ALTO'],
  ['29', 'Fabricação de veículos automotores, reboques e carrocerias', 'C', 'ALTO'],
  ['30', 'Fabricação de outros equipamentos de transporte, exceto veículos automotores', 'C', 'ALTO'],
  ['31', 'Fabricação de móveis', 'C', 'MEDIO_ALTO'],
  ['32', 'Fabricação de produtos diversos', 'C', 'MEDIO'],
  ['33', 'Manutenção, reparação e instalação de máquinas e equipamentos', 'C', 'ALTO'],
  ['35', 'Eletricidade, gás e outras utilidades', 'D', 'ALTO'],
  ['36', 'Captação, tratamento e distribuição de água', 'E', 'ALTO'],
  ['37', 'Esgoto e atividades relacionadas', 'E', 'ALTO'],
  ['38', 'Coleta, tratamento e disposição de resíduos; recuperação de materiais', 'E', 'ALTO'],
  ['39', 'Descontaminação e outros serviços de gestão de resíduos', 'E', 'ALTO'],
  ['41', 'Construção de edifícios', 'F', 'ALTO'],
  ['42', 'Obras de infraestrutura', 'F', 'ALTO'],
  ['43', 'Serviços especializados para construção', 'F', 'ALTO'],
  ['45', 'Comércio e reparação de veículos automotores e motocicletas', 'G', 'MEDIO_ALTO'],
  ['46', 'Comércio por atacado, exceto veículos automotores e motocicletas', 'G', 'MEDIO'],
  ['47', 'Comércio varejista', 'G', 'MEDIO'],
  ['49', 'Transporte terrestre', 'H', 'ALTO'],
  ['50', 'Transporte aquaviário', 'H', 'ALTO'],
  ['51', 'Transporte aéreo', 'H', 'ALTO'],
  ['52', 'Armazenamento e atividades auxiliares dos transportes', 'H', 'ALTO'],
  ['53', 'Correio e outras atividades de entrega', 'H', 'MEDIO_ALTO'],
  ['55', 'Alojamento', 'I', 'MEDIO'],
  ['56', 'Alimentação', 'I', 'MEDIO'],
  ['58', 'Edição e edição integrada à impressão', 'J', 'BAIXO_MEDIO'],
  ['59', 'Atividades cinematográficas, produção de vídeos e de programas de televisão; gravação de som e edição de música', 'J', 'MEDIO'],
  ['60', 'Atividades de rádio e de televisão', 'J', 'MEDIO'],
  ['61', 'Telecomunicações', 'J', 'MEDIO_ALTO'],
  ['62', 'Atividades dos serviços de tecnologia da informação', 'J', 'BAIXO'],
  ['63', 'Atividades de prestação de serviços de informação', 'J', 'BAIXO'],
  ['64', 'Atividades de serviços financeiros', 'K', 'BAIXO'],
  ['65', 'Seguros, resseguros, previdência complementar e planos de saúde', 'K', 'BAIXO'],
  ['66', 'Atividades auxiliares dos serviços financeiros, seguros e previdência complementar', 'K', 'BAIXO'],
  ['68', 'Atividades imobiliárias', 'L', 'BAIXO_MEDIO'],
  ['69', 'Atividades jurídicas, de contabilidade e de auditoria', 'M', 'BAIXO'],
  ['70', 'Atividades de sedes de empresas e de consultoria em gestão empresarial', 'M', 'BAIXO'],
  ['71', 'Serviços de arquitetura e engenharia; testes e análises técnicas', 'M', 'MEDIO'],
  ['72', 'Pesquisa e desenvolvimento científico', 'M', 'MEDIO_ALTO'],
  ['73', 'Publicidade e pesquisa de mercado', 'M', 'BAIXO'],
  ['74', 'Outras atividades profissionais, científicas e técnicas', 'M', 'BAIXO_MEDIO'],
  ['75', 'Atividades veterinárias', 'M', 'MEDIO_ALTO'],
  ['77', 'Aluguéis não-imobiliários e gestão de ativos intangíveis não-financeiros', 'N', 'MEDIO'],
  ['78', 'Seleção, agenciamento e locação de mão de obra', 'N', 'MEDIO'],
  ['79', 'Agências de viagens, operadores turísticos e serviços de reservas', 'N', 'BAIXO_MEDIO'],
  ['80', 'Atividades de vigilância, segurança e investigação', 'N', 'ALTO'],
  ['81', 'Serviços para edifícios e atividades paisagísticas', 'N', 'ALTO'],
  ['82', 'Serviços de escritório, de apoio administrativo e outros serviços prestados às empresas', 'N', 'BAIXO_MEDIO'],
  ['84', 'Administração pública, defesa e seguridade social', 'O', 'MEDIO_ALTO'],
  ['85', 'Educação', 'P', 'MEDIO'],
  ['86', 'Atividades de atenção à saúde humana', 'Q', 'ALTO'],
  ['87', 'Atividades de atenção à saúde humana integradas com assistência social, prestadas em residências coletivas e particulares', 'Q', 'ALTO'],
  ['88', 'Serviços de assistência social sem alojamento', 'Q', 'MEDIO_ALTO'],
  ['90', 'Atividades artísticas, criativas e de espetáculos', 'R', 'MEDIO'],
  ['91', 'Atividades ligadas ao patrimônio cultural e ambiental', 'R', 'MEDIO'],
  ['92', 'Atividades de exploração de jogos de azar e apostas', 'R', 'MEDIO'],
  ['93', 'Atividades esportivas e de recreação e lazer', 'R', 'MEDIO_ALTO'],
  ['94', 'Atividades de organizações associativas', 'S', 'BAIXO_MEDIO'],
  ['95', 'Reparação e manutenção de equipamentos de informática e comunicação e de objetos pessoais e domésticos', 'S', 'MEDIO'],
  ['96', 'Outras atividades de serviços pessoais', 'S', 'MEDIO'],
  ['97', 'Serviços domésticos', 'T', 'MEDIO'],
  ['99', 'Organismos internacionais e outras instituições extraterritoriais', 'U', 'BAIXO_MEDIO'],
];

// Perfil de saída por nível de risco (defaults; o admin pode ajustar por divisão).
function profile(risk) {
  switch (risk) {
    case 'ALTO':
      return {
        method: 'ORGANIZACIONAL', pgr: true, inv: true, aep: true, evid: true, exec: true, plan: true,
        out: 'Diagnóstico Organizacional + PGR + Inventário de Riscos + AEP + Evidências + Relatório Executivo + Plano de Ação',
        obs: 'Divisão de alto risco ocupacional. Exposição relevante provável (físico, químico, biológico, ergonômico ou de acidentes). PGR e inventário de riscos fortemente recomendados.',
        trig: [],
      };
    case 'MEDIO_ALTO':
      return {
        method: 'ORGANIZACIONAL', pgr: true, inv: true, aep: true, evid: true, exec: true, plan: true,
        out: 'Diagnóstico Organizacional + AEP + Inventário de Riscos + Evidências + Relatório Executivo + Plano de Ação',
        obs: 'Risco médio-alto. Operação com exposição relevante; recomenda-se diagnóstico organizacional com documentação técnica ampliada.',
        trig: [],
      };
    case 'MEDIO':
      return {
        method: 'ESSENCIAL', pgr: false, inv: true, aep: false, evid: true, exec: true, plan: true,
        out: 'Diagnóstico Essencial ou Organizacional conforme porte e operação + Relatório Executivo + Plano de Ação',
        obs: 'Risco médio. O método depende de porte, operação presencial, turnos, atendimento ao público e exposição. Avaliar gatilhos operacionais.',
        trig: ['qualquer_gatilho_operacional', '6_ou_mais_colaboradores_com_operacao'],
      };
    case 'BAIXO_MEDIO':
      return {
        method: 'ESSENCIAL', pgr: false, inv: false, aep: false, evid: true, exec: true, plan: true,
        out: 'Diagnóstico Essencial + Relatório Executivo + Plano de Ação (elevar conforme porte/operação)',
        obs: 'Risco baixo-médio. Essencial como padrão; elevar para Organizacional conforme número de colaboradores, unidades e operação.',
        trig: ['mais_de_20_colaboradores', 'multiplas_unidades', 'equipe_operacional', 'atendimento_publico_intenso', 'turnos', 'metas_comerciais_intensas', 'historico_afastamentos', 'demanda_nr1_completa', 'trabalho_externo'],
      };
    default: // BAIXO
      return {
        method: 'ESSENCIAL', pgr: false, inv: false, aep: false, evid: false, exec: true, plan: true,
        out: 'Diagnóstico Essencial + Relatório Executivo + Orientações de Plano de Ação',
        obs: 'Risco baixo. Atividade predominantemente administrativa/intelectual. O diagnóstico essencial costuma ser suficiente, salvo porte/operação relevantes.',
        trig: ['mais_de_50_colaboradores', 'operacao_presencial_complexa', 'multiplas_filiais', 'lideranca_distribuida', 'demanda_formal_compliance', 'solicitacao_pgr_nr1_completa'],
      };
  }
}

const ROWS = BASE.map(([divisionCode, officialName, cnaeSection, preliminaryRiskLevel]) => {
  const p = profile(preliminaryRiskLevel);
  return {
    divisionCode, officialName, cnaeSection, preliminaryRiskLevel,
    defaultMethod: p.method, defaultTechnicalOutput: p.out,
    pgrRequired: p.pgr, riskInventoryRequired: p.inv, aepRequired: p.aep,
    evidenceRequired: p.evid, executiveReportRequired: p.exec, actionPlanRequired: p.plan,
    organizationalTriggerRules: p.trig, technicalObservation: p.obs,
  };
});

// ── Geração da migração SQL ──────────────────────────────────────────────────
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const b = (v) => (v ? 'true' : 'false');

const valuesSql = ROWS.map((r) =>
  `(gen_random_uuid(), ${q(r.divisionCode)}, ${q(r.officialName)}, ${q(r.cnaeSection)}, ` +
  `${q(r.preliminaryRiskLevel)}, ${q(r.defaultMethod)}, ${q(r.defaultTechnicalOutput)}, ` +
  `${b(r.pgrRequired)}, ${b(r.riskInventoryRequired)}, ${b(r.aepRequired)}, ${b(r.evidenceRequired)}, ` +
  `${b(r.executiveReportRequired)}, ${b(r.actionPlanRequired)}, ` +
  `${q(JSON.stringify(r.organizationalTriggerRules))}::jsonb, ${q(r.technicalObservation)}, true, now(), now())`,
).join(',\n');

const migration = `-- Motor de Decisão CNAE/NR-1 — tabelas + seed das 87 divisões CNAE 2.0.
-- (gerado por packages/db/prisma/data/cnae-divisions.source.mjs)

-- CreateEnum
CREATE TYPE "CnaeRiskLevel" AS ENUM ('BAIXO', 'BAIXO_MEDIO', 'MEDIO', 'MEDIO_ALTO', 'ALTO');

-- CreateTable
CREATE TABLE "cnae_division_rules" (
    "id" UUID NOT NULL,
    "division_code" TEXT NOT NULL,
    "official_name" TEXT NOT NULL,
    "cnae_section" TEXT,
    "preliminary_risk_level" "CnaeRiskLevel" NOT NULL,
    "default_method" "DiagnosticMethod" NOT NULL,
    "default_technical_output" TEXT NOT NULL,
    "pgr_required" BOOLEAN NOT NULL DEFAULT false,
    "risk_inventory_required" BOOLEAN NOT NULL DEFAULT false,
    "aep_required" BOOLEAN NOT NULL DEFAULT false,
    "evidence_required" BOOLEAN NOT NULL DEFAULT false,
    "executive_report_required" BOOLEAN NOT NULL DEFAULT false,
    "action_plan_required" BOOLEAN NOT NULL DEFAULT false,
    "organizational_trigger_rules" JSONB,
    "technical_observation" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cnae_division_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cnae_decision_history" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "cnpj" TEXT,
    "cnae_code" TEXT,
    "division_code" TEXT,
    "input_data_json" JSONB NOT NULL,
    "division_rule_json" JSONB,
    "decision_result_json" JSONB NOT NULL,
    "recommended_method" TEXT,
    "risk_level" TEXT,
    "manual_review_required" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cnae_decision_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cnae_division_rules_division_code_key" ON "cnae_division_rules"("division_code");
CREATE INDEX "cnae_decision_history_cnpj_idx" ON "cnae_decision_history"("cnpj");
CREATE INDEX "cnae_decision_history_division_code_idx" ON "cnae_decision_history"("division_code");
CREATE INDEX "cnae_decision_history_created_at_idx" ON "cnae_decision_history"("created_at");

-- Seed: 87 divisões CNAE 2.0 (classificação preliminar técnica; editável pelo admin).
INSERT INTO "cnae_division_rules" ("id","division_code","official_name","cnae_section","preliminary_risk_level","default_method","default_technical_output","pgr_required","risk_inventory_required","aep_required","evidence_required","executive_report_required","action_plan_required","organizational_trigger_rules","technical_observation","is_active","created_at","updated_at") VALUES
${valuesSql};
`;

// ── Geração do TS de referência ──────────────────────────────────────────────
const ts = `// GERADO por cnae-divisions.source.mjs — NÃO editar à mão.
// As 87 divisões da CNAE 2.0 + classificação preliminar técnica de risco.
// Em produção a tabela cnae_division_rules é populada pela migração; este array
// serve de referência/seed-dev/testes. Editável pelo admin via API depois.

export type CnaeRiskLevel = 'BAIXO' | 'BAIXO_MEDIO' | 'MEDIO' | 'MEDIO_ALTO' | 'ALTO';
export type CnaeMethod = 'ESSENCIAL' | 'ORGANIZACIONAL';

export interface CnaeDivisionSeed {
  divisionCode: string;
  officialName: string;
  cnaeSection: string;
  preliminaryRiskLevel: CnaeRiskLevel;
  defaultMethod: CnaeMethod;
  defaultTechnicalOutput: string;
  pgrRequired: boolean;
  riskInventoryRequired: boolean;
  aepRequired: boolean;
  evidenceRequired: boolean;
  executiveReportRequired: boolean;
  actionPlanRequired: boolean;
  organizationalTriggerRules: string[];
  technicalObservation: string;
}

export const CNAE_DIVISIONS: CnaeDivisionSeed[] = ${JSON.stringify(ROWS, null, 2)};
`;

const migDir = join(__dirname, '..', 'migrations', '20260624160000_cnae_decision_engine');
writeFileSync(join(__dirname, 'cnae-divisions.ts'), ts);
console.log(`✔ cnae-divisions.ts (${ROWS.length} divisões)`);
console.log(`→ migração: ${join(migDir, 'migration.sql')} (criar a pasta antes)`);
writeFileSync(join(__dirname, 'cnae-migration.generated.sql'), migration);
console.log('✔ cnae-migration.generated.sql (copiar p/ a pasta da migração)');
