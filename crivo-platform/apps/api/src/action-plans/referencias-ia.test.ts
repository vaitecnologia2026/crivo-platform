import { describe, expect, it } from 'vitest';
import { referenciasParaOsFatores } from './psychosocial-action-plans';

// Refinamento da IA do Plano (18/09): o prompt leva a referência técnica só
// das famílias de fator presentes no lote (Guia MTE/NR-1, HSE, ISO 45003, OMS/OIT).

describe('referenciasParaOsFatores', () => {
  it('casa os fatores da homologação com as famílias certas', () => {
    const txt = referenciasParaOsFatores([
      { label: 'Sobrecarga de trabalho', dimensionLabel: 'Demandas e Ritmo de Trabalho' },
      { label: 'Falta de suporte gerencial', dimensionLabel: 'Liderança e Suporte' },
      { label: 'Baixa autonomia', dimensionLabel: 'Autonomia e Participação' },
    ]);
    expect(txt).toContain('Demandas / sobrecarga');
    expect(txt).toContain('priorização de tarefas');
    expect(txt).toContain('Suporte / liderança');
    expect(txt).toContain('Controle / autonomia');
    // não puxa família ausente
    expect(txt).not.toContain('Relações / assédio');
    expect(txt).not.toContain('Mudanças / previsibilidade');
  });

  it('ignora acento e caixa; usa a definição quando o rótulo não diz nada', () => {
    const txt = referenciasParaOsFatores([{ label: 'Fator 7', definition: 'Má gestão de MUDANÇAS organizacionais' }]);
    expect(txt).toContain('Mudanças / previsibilidade');
  });

  it('sem casamento devolve vazio (o prompt segue sem o bloco)', () => {
    expect(referenciasParaOsFatores([{ label: 'xyz' }])).toBe('');
  });
});
