import { describe, expect, it } from 'vitest';
import { caminhoMapa, listarEmPortugues, sinteseMapa } from './preliminary-reports.service';

/**
 * A Síntese executiva e o Caminho recomendado nomeavam UMA dimensão em cada
 * extremo, porque pegavam `sort(...)[0]`. Com empate — duas dimensões em 87,5,
 * duas em 12,5 — o texto citava metade do que a tabela ao lado mostra, e o
 * leitor via a contradição.
 */

const FAIXAS = [
  { min: 0, max: 49 },
  { min: 50, max: 64 },
  { min: 65, max: 79 },
  { min: 80, max: 100 },
];

const d = (label: string, score: number, faixaLabel: string) => ({ label, score, faixaLabel });

// O caso real do PDF que o cliente conferiu.
const CASO_REAL = [
  d('Pressão Organizacional e Rotina', 12.5, 'Atenção crítica'),
  d('Liderança e Sustentação', 87.5, 'Estruturado'),
  d('Cultura, Comunicação e Confiança', 62.5, 'Vulnerável'),
  d('Fatores Organizacionais e Psicossociais', 12.5, 'Atenção crítica'),
  d('Governança, Evidências e Plano de Ação', 87.5, 'Estruturado'),
  d('Futuro do Trabalho e IA', 37.5, 'Atenção crítica'),
];

describe('listarEmPortugues', () => {
  it('enumera sem vírgula antes do "e"', () => {
    expect(listarEmPortugues([])).toBe('');
    expect(listarEmPortugues(['A'])).toBe('A');
    expect(listarEmPortugues(['A', 'B'])).toBe('A e B');
    expect(listarEmPortugues(['A', 'B', 'C'])).toBe('A, B e C');
  });
});

describe('sinteseMapa', () => {
  it('nomeia TODAS as dimensões empatadas nos dois extremos', () => {
    const t = sinteseMapa(CASO_REAL, FAIXAS);
    // Empate na maior nota: as duas de 87,5.
    expect(t).toContain('Liderança e Sustentação e Governança, Evidências e Plano de Ação');
    // Empate na menor: as duas de 12,5.
    expect(t).toContain('Pressão Organizacional e Rotina e Fatores Organizacionais e Psicossociais');
    // Concordância verbal no plural.
    expect(t).toContain('apresentam o melhor desempenho');
    expect(t).toContain('respondem por');
    expect(t).toContain('empatadas em');
  });

  it('mantém o singular quando não há empate', () => {
    const t = sinteseMapa(
      [d('Alfa', 90, 'Estruturado'), d('Beta', 50, 'Vulnerável'), d('Gama', 20, 'Atenção crítica')],
      FAIXAS,
    );
    expect(t).toContain('Alfa apresenta o melhor desempenho');
    expect(t).toContain('Gama responde por');
    expect(t).not.toContain('empatadas');
    // 90 está na faixa mais alta: leitura positiva autorizada.
    expect(t).not.toContain('relativo');
  });

  it('não chama de ponto forte a maior nota fora da faixa mais alta, mesmo empatada', () => {
    const t = sinteseMapa(
      [d('Alfa', 60, 'Vulnerável'), d('Beta', 60, 'Vulnerável'), d('Gama', 20, 'Atenção crítica')],
      FAIXAS,
    );
    expect(t).toContain('Alfa e Beta apresentam o melhor desempenho relativo');
    expect(t).toContain('não configuram ponto forte');
  });

  it('quando tudo empata, diz isso em vez de forjar um contraste', () => {
    const t = sinteseMapa(
      [d('Alfa', 50, 'Vulnerável'), d('Beta', 50, 'Vulnerável'), d('Gama', 50, 'Vulnerável')],
      FAIXAS,
    );
    expect(t).toContain('As 3 dimensões avaliadas pontuaram igual');
    expect(t).not.toContain('No outro extremo');
  });

  it('uma dimensão só e lista vazia continuam como antes', () => {
    expect(sinteseMapa([d('Alfa', 70, 'Em estruturação')], FAIXAS)).toContain(
      'A leitura concentra-se em Alfa',
    );
    expect(sinteseMapa([], FAIXAS)).toBe('Sem dimensões avaliadas nesta leitura.');
  });
});

describe('caminhoMapa', () => {
  it('manda começar pelas DUAS de menor nota quando há empate', () => {
    const t = caminhoMapa(CASO_REAL);
    expect(t).toContain(
      'Comece por Pressão Organizacional e Rotina e Fatores Organizacionais e Psicossociais',
    );
    expect(t).toContain('são as dimensões de menor sustentação, empatadas');
  });

  it('mantém o singular sem empate', () => {
    const t = caminhoMapa([d('Alfa', 90, 'Estruturado'), d('Gama', 20, 'Atenção crítica')]);
    expect(t).toContain('Comece por Gama:');
    expect(t).toContain('é a dimensão de menor sustentação');
  });

  it('com tudo no mesmo patamar não manda "começar por todas"', () => {
    const t = caminhoMapa([d('Alfa', 50, 'Vulnerável'), d('Beta', 50, 'Vulnerável')]);
    expect(t).toContain('mesmo patamar');
    expect(t).not.toContain('Comece por');
  });

  it('sem dimensão nenhuma segue com a recomendação genérica', () => {
    expect(caminhoMapa([])).toContain('Aplique o CRIVO Diagnóstico');
  });
});
