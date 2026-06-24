import { Injectable, Logger } from '@nestjs/common';
import { consultarCnpj } from '../common/cnpj';

/**
 * Camada de integração de CNPJ — abstrai o provedor para que a regra de negócio
 * (CnaeDecisionEngine) nunca dependa de uma API externa específica. Trocar o
 * provedor é só mudar `CNPJ_PROVIDER` (ou adicionar um case aqui), sem tocar no
 * motor de decisão nem no frontend (que chama só o backend da CRIVO).
 *
 * Provedores: brasilapi (default, implementado) · cnpjws · receitaws (futuros).
 */
export interface CnpjCompanyData {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  porte: string | null;
  naturezaJuridica: string | null;
  capitalSocial: number | null;
  cnaePrincipalCodigo: string | null;
  cnaePrincipalDescricao: string | null;
  cnaesSecundarios: { codigo: string; descricao: string | null }[];
  endereco: {
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    municipio: string | null;
    uf: string | null;
    cep: string | null;
  };
  telefone: string | null;
  email: string | null;
  fonte: string;
}

@Injectable()
export class CnpjProviderService {
  private readonly log = new Logger('CnpjProvider');

  private provider(): string {
    return (process.env.CNPJ_PROVIDER || 'brasilapi').toLowerCase();
  }

  /** Consulta o CNPJ no provedor configurado. Retorna null se não encontrar/erro. */
  async consult(cnpj: string | null | undefined): Promise<CnpjCompanyData | null> {
    const limpo = (cnpj ?? '').replace(/\D/g, '');
    if (limpo.length !== 14) return null;

    switch (this.provider()) {
      case 'brasilapi':
        return this.fromBrasilApi(limpo);
      // case 'cnpjws':   return this.fromCnpjWs(limpo);
      // case 'receitaws': return this.fromReceitaWs(limpo);
      default:
        this.log.warn(`Provedor de CNPJ desconhecido "${this.provider()}" — usando brasilapi.`);
        return this.fromBrasilApi(limpo);
    }
  }

  /** BrasilAPI (reusa common/cnpj com o User-Agent que escapa do bloqueio 403). */
  private async fromBrasilApi(cnpj: string): Promise<CnpjCompanyData | null> {
    const d = await consultarCnpj(cnpj);
    if (!d) return null;
    return {
      cnpj: d.cnpj || cnpj,
      razaoSocial: d.razaoSocial,
      nomeFantasia: d.nomeFantasia,
      situacaoCadastral: d.situacao,
      porte: d.porte,
      naturezaJuridica: d.naturezaJuridica,
      capitalSocial: d.capitalSocial,
      cnaePrincipalCodigo: d.cnaeCodigo != null ? String(d.cnaeCodigo) : null,
      cnaePrincipalDescricao: d.cnaePrincipal,
      cnaesSecundarios: d.cnaesSecundarios ?? [],
      endereco: {
        logradouro: d.logradouro,
        numero: d.numero,
        bairro: d.bairro,
        municipio: d.cidade,
        uf: d.uf,
        cep: d.cep,
      },
      telefone: d.telefone,
      email: d.email,
      fonte: 'brasilapi',
    };
  }
}
