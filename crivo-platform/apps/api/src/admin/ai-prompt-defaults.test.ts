import { describe, it, expect } from 'vitest';
import { AI_PROMPT_DEFAULTS, defaultPrompt, isAiPromptUseCase } from './ai-prompt-defaults';

const EXPECTED = ['copiloto', 'preliminary_report', 'pocket_summary', 'people_analytics'];

describe('AI_PROMPT_DEFAULTS (central de prompts)', () => {
  it('tem exatamente os 4 casos de uso esperados, sem duplicatas', () => {
    const useCases = AI_PROMPT_DEFAULTS.map((p) => p.useCase);
    expect(new Set(useCases).size).toBe(useCases.length);
    expect(useCases.sort()).toEqual([...EXPECTED].sort());
  });

  it('cada caso tem label, descrição e conteúdo não-triviais', () => {
    for (const p of AI_PROMPT_DEFAULTS) {
      expect(p.label.length).toBeGreaterThan(3);
      expect(p.description.length).toBeGreaterThan(10);
      expect(p.content.trim().length).toBeGreaterThan(50);
    }
  });

  it('isAiPromptUseCase valida corretamente', () => {
    for (const u of EXPECTED) expect(isAiPromptUseCase(u)).toBe(true);
    expect(isAiPromptUseCase('inexistente')).toBe(false);
    expect(isAiPromptUseCase('')).toBe(false);
  });

  it('defaultPrompt devolve o conteúdo do caso e vazio p/ desconhecido', () => {
    expect(defaultPrompt('copiloto')).toContain('Copiloto CRIVO');
    expect(defaultPrompt('preliminary_report')).toContain('Relator Preliminar CRIVO');
    expect(defaultPrompt('pocket_summary')).toContain('Mentoria IA do CRIVO Pocket');
    expect(defaultPrompt('people_analytics')).toContain('People Analytics');
    // @ts-expect-error — caso inválido
    expect(defaultPrompt('nope')).toBe('');
  });
});
