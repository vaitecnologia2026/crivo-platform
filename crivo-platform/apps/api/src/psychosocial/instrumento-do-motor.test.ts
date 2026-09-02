import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PSYCHOSOCIAL_QUESTIONS } from '@crivo/types';

/**
 * As perguntas do Organizacional saíam sempre do instrumento `PSYCHOSOCIAL`.
 * Com ele fora do catálogo (alt. 084), o cliente refez o diagnóstico no Motor e
 * o questionário continuava vindo do padrão embutido — o cadastro dele não valia
 * para nada. Aqui fica preso: o motor lê o instrumento do método ORGANIZACIONAL.
 */
const { loadActiveMethodologyConfig, resolvePsychosocialInstrument } = vi.hoisted(() => ({
  loadActiveMethodologyConfig: vi.fn(),
  resolvePsychosocialInstrument: vi.fn(),
}));
vi.mock('../admin/methodology.service', () => ({
  loadActiveMethodologyConfig,
  resolvePsychosocialInstrument,
  loadMethodologyConfigByVersion: vi.fn(),
  resolveActiveMethodology: vi.fn(),
}));

import { PsychosocialService } from './psychosocial.service';

const CFG = {
  questions: [
    { dimensionSlug: 'demandas', text: 'O volume de trabalho é compatível com o tempo disponível.' },
    { dimensionSlug: 'controle', text: 'Tenho autonomia para organizar minhas tarefas.' },
  ],
};

beforeEach(() => {
  loadActiveMethodologyConfig.mockReset();
  resolvePsychosocialInstrument.mockReset();
});

describe('questionário Organizacional segue o instrumento do Motor', () => {
  it('lê o diagnóstico cadastrado pelo cliente, não o slug legado', async () => {
    resolvePsychosocialInstrument.mockResolvedValue('diagnostico-organizacional');
    loadActiveMethodologyConfig.mockResolvedValue(CFG);
    const svc = new PsychosocialService({} as never);

    expect(await svc.getQuestions()).toEqual([
      { id: 1, dimension: 'demandas', text: CFG.questions[0].text },
      { id: 2, dimension: 'controle', text: CFG.questions[1].text },
    ]);
    // É o slug resolvido que vai ao carregador — não 'PSYCHOSOCIAL'.
    expect(loadActiveMethodologyConfig.mock.calls[0]?.[1]).toBe('diagnostico-organizacional');
  });

  it('o link público e a campanha usam a MESMA fonte', async () => {
    resolvePsychosocialInstrument.mockResolvedValue('diagnostico-organizacional');
    loadActiveMethodologyConfig.mockResolvedValue(CFG);
    const svc = new PsychosocialService({} as never);

    expect(await svc.publicQuestions()).toEqual(await svc.getQuestions());
    expect(loadActiveMethodologyConfig.mock.calls.every((c) => c[1] === 'diagnostico-organizacional')).toBe(true);
  });

  it('sem metodologia publicada, mantém o padrão embutido (nada fica sem questionário)', async () => {
    resolvePsychosocialInstrument.mockResolvedValue('diagnostico-organizacional');
    loadActiveMethodologyConfig.mockResolvedValue(null);
    const svc = new PsychosocialService({} as never);

    expect(await svc.publicQuestions()).toEqual(PSYCHOSOCIAL_QUESTIONS);
  });
});
