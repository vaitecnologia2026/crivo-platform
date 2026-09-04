import { describe, expect, it } from 'vitest';
import {
  gerarMapaExecutivoPdf,
  nomeArquivoMapa,
  type DadosMapaExecutivo,
} from './mapa-executivo-pdf';

const DADOS: DadosMapaExecutivo = {
  empresa: 'Ação & Cia Ltda',
  respondente: 'Maria Souza',
  data: new Date(2026, 8, 4),
  score: 41.7,
  faixaLabel: 'Atenção crítica',
  faixaColor: '#c0392b',
  panorama: 'Leitura preliminar da organização.',
  dimensoes: [
    { label: 'Clima e comunicação', score: 38, faixaLabel: 'Atenção crítica', faixaColor: '#c0392b' },
    { label: 'Liderança', score: 52, faixaLabel: 'Vulnerável', faixaColor: '#e08a1e' },
  ],
  faixas: [
    { label: 'Atenção crítica', min: 0, max: 49, color: '#c0392b' },
    { label: 'Vulnerável', min: 50, max: 64, color: '#e08a1e' },
  ],
  sintese: 'Liderança sustenta; clima pressiona.',
  caminho: 'Comece por clima e comunicação.',
};

describe('nomeArquivoMapa', () => {
  it('usa o padrão MAPA_Executivo_CRIVO_<EMPRESA>_<AAAA-MM-DD>.pdf', () => {
    // Setembro é o mês 8 no construtor do Date — o nome tem de sair com 09.
    expect(nomeArquivoMapa('Empresa Exemplo', new Date(2026, 8, 4))).toBe(
      'MAPA_Executivo_CRIVO_Empresa_Exemplo_2026-09-04.pdf',
    );
  });

  it('tira acento e símbolo do nome da empresa', () => {
    // Cliente de e-mail que tropeça em nome acentuado não pode derrubar o anexo.
    expect(nomeArquivoMapa('Ação & Cia Ltda.', new Date(2026, 0, 31))).toBe(
      'MAPA_Executivo_CRIVO_Acao_Cia_Ltda_2026-01-31.pdf',
    );
  });

  it('não sai sem nome quando a empresa é vazia ou só símbolos', () => {
    expect(nomeArquivoMapa('', new Date(2026, 11, 25))).toBe(
      'MAPA_Executivo_CRIVO_Empresa_2026-12-25.pdf',
    );
    expect(nomeArquivoMapa('***', new Date(2026, 11, 25))).toBe(
      'MAPA_Executivo_CRIVO_Empresa_2026-12-25.pdf',
    );
  });
});

describe('gerarMapaExecutivoPdf', () => {
  it('devolve um PDF válido', async () => {
    const buf = await gerarMapaExecutivoPdf(DADOS);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('gera mesmo sem faixas publicadas no Motor', async () => {
    // Sem metodologia parametrizada o anexo ainda tem de sair — o lead não pode
    // ficar sem o MAPA por causa de configuração ausente.
    const buf = await gerarMapaExecutivoPdf({ ...DADOS, faixas: [], dimensoes: [] });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
