import { describe, it, expect } from 'vitest';
import {
  AI_PROMPT_DEFAULTS,
  defaultPrompt,
  diagnosticPromptDefault,
  diagnosticUseCase,
  isAiPromptUseCase,
  slugFromUseCase,
} from './ai-prompt-defaults';

const EXPECTED = ['copiloto', 'preliminary_report', 'pocket_summary', 'people_analytics', 'document_texts'];

describe('AI_PROMPT_DEFAULTS (central de prompts)', () => {
  it('tem exatamente os 5 casos de uso esperados, sem duplicatas', () => {
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
    expect(defaultPrompt('document_texts')).toContain('REVISADO E APROVADO pela equipe CRIVO');
    // @ts-expect-error — caso inválido
    expect(defaultPrompt('nope')).toBe('');
  });
});

// A5 — casos DINÂMICOS por diagnóstico do Motor (diagnostic_<slug>).
describe('casos dinâmicos diagnostic_<slug>', () => {
  it('diagnosticUseCase monta o useCase com o prefixo', () => {
    expect(diagnosticUseCase('clima-organizacional')).toBe('diagnostic_clima-organizacional');
  });

  it('slugFromUseCase aceita slugs válidos (kebab e built-in históricos)', () => {
    expect(slugFromUseCase('diagnostic_clima-organizacional')).toBe('clima-organizacional');
    expect(slugFromUseCase('diagnostic_PRE_DIAGNOSTIC')).toBe('PRE_DIAGNOSTIC');
    expect(slugFromUseCase('diagnostic_PSYCHOSOCIAL')).toBe('PSYCHOSOCIAL');
  });

  it('slugFromUseCase rejeita prefixo errado, vazio e formato inválido', () => {
    expect(slugFromUseCase('copiloto')).toBeNull();
    expect(slugFromUseCase('diagnostic_')).toBeNull();
    expect(slugFromUseCase('diagnostic_AB')).toBeNull(); // maiúsculo não-built-in
    expect(slugFromUseCase('diagnostic_a')).toBeNull(); // curto demais
    expect(slugFromUseCase('diag_clima')).toBeNull();
  });

  it('diagnosticPromptDefault gera prompt não-trivial com o nome do instrumento', () => {
    const d = diagnosticPromptDefault({ slug: 'governanca-ia', name: 'Governança de IA', description: 'Prontidão da empresa para IA.' });
    expect(d.useCase).toBe('diagnostic_governanca-ia');
    expect(d.label).toContain('Governança de IA');
    expect(d.content).toContain('Governança de IA');
    expect(d.content).toContain('Prontidão da empresa para IA.');
    expect(d.content.length).toBeGreaterThan(200);
  });
});
