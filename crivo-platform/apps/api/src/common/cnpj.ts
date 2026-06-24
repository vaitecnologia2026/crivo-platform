import { Logger } from '@nestjs/common';

/**
 * Consulta de CNPJ na BrasilAPI — base para o grau de risco da empresa.
 * Best-effort: NUNCA lança (retorna null em erro) para não travar o cadastro do lead.
 */
const log = new Logger('CNPJ');

export interface CnpjData {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacao: string | null;
  cnaeCodigo: number | null;
  cnaePrincipal: string | null;
  porte: string | null;
  naturezaJuridica: string | null;
  capitalSocial: number | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  socios: { nome?: string; qualificacao?: string }[];
}

export async function consultarCnpj(cnpj: string | null | undefined): Promise<CnpjData | null> {
  const limpo = (cnpj ?? '').replace(/\D/g, '');
  if (limpo.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, unknown>;
    const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
    const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
    const qsa = Array.isArray(d.qsa) ? (d.qsa as Record<string, unknown>[]) : [];
    return {
      cnpj: str(d.cnpj) ?? limpo,
      razaoSocial: str(d.razao_social),
      nomeFantasia: str(d.nome_fantasia),
      situacao: str(d.descricao_situacao_cadastral),
      cnaeCodigo: num(d.cnae_fiscal),
      cnaePrincipal: str(d.cnae_fiscal_descricao),
      porte: str(d.porte),
      naturezaJuridica: str(d.natureza_juridica),
      capitalSocial: num(d.capital_social),
      cidade: str(d.municipio),
      uf: str(d.uf),
      bairro: str(d.bairro),
      logradouro: str(d.logradouro),
      numero: str(d.numero),
      cep: str(d.cep),
      telefone: str(d.ddd_telefone_1),
      email: str(d.email),
      socios: qsa.slice(0, 20).map((s) => ({
        nome: str(s.nome_socio) ?? str(s.nome) ?? undefined,
        qualificacao: str(s.qualificacao_socio) ?? undefined,
      })),
    };
  } catch (e) {
    log.warn(`Falha ao consultar CNPJ ${limpo}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/**
 * Grau de risco PRELIMINAR derivado do CNPJ (base do diagnóstico, NR-1).
 * Combina o PORTE (escala de exposição) com o SETOR/CNAE (tensão psicossocial
 * típica). Heurística inicial — refinável com as regras de negócio do cliente.
 */
export function grauDeRiscoCnpj(data: CnpjData | null): 'BAIXO' | 'MEDIO' | 'ALTO' | null {
  if (!data) return null;
  // Divisões CNAE (2 primeiros dígitos) com maior exposição a fatores psicossociais.
  const setoresTensos = new Set([
    '86', '87', '88', // saúde e assistência social
    '49', '50', '51', '52', '53', // transporte e logística
    '80', // vigilância e segurança
    '82', // teleatendimento / serviços administrativos
    '64', '65', '66', // financeiro / seguros
    '47', '56', // varejo / alimentação
    '85', // educação
    '41', '42', '43', // construção
    '10', '11', '13', '14', // indústrias com turnos
  ]);
  const div = String(data.cnaeCodigo ?? '').padStart(7, '0').slice(0, 2);
  const setorTenso = setoresTensos.has(div);
  const grande = data.porte === 'DEMAIS';
  const medio = data.porte === 'EPP';
  if (grande && setorTenso) return 'ALTO';
  if (grande || (medio && setorTenso)) return 'MEDIO';
  if (setorTenso || medio) return 'MEDIO';
  return 'BAIXO';
}
