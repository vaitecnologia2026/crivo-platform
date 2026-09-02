import { describe, expect, it, vi } from 'vitest';
import { resolvePsychosocialInstrument, usesPsychosocialEngine } from './methodology.service';

/**
 * O motor psicossocial (Matriz de Risco 5×5, Perfil de grupo, Dossiê NR-1) era
 * preso ao slug `PSYCHOSOCIAL`. Removido esse instrumento built-in do catálogo
 * (alt. 084), quem cadastrasse o Organizacional do zero no Motor ficava com a
 * matriz VAZIA e as respostas na tabela errada. Estes testes prendem a regra
 * nova: quem manda é o instrumento ATIVO do método ORGANIZACIONAL.
 */
function prismaCom(instrumento: { slug: string } | null) {
  return {
    admin: {
      diagnosticInstrument: { findFirst: vi.fn(async () => instrumento) },
    },
  } as never;
}

describe('instrumento do motor psicossocial (NR-1)', () => {
  it('usa o instrumento ATIVO do método ORGANIZACIONAL cadastrado no Motor', async () => {
    const prisma = prismaCom({ slug: 'diagnostico-organizacional' });
    expect(await resolvePsychosocialInstrument(prisma)).toBe('diagnostico-organizacional');
  });

  it('sem instrumento cadastrado, cai no slug legado (nada quebra)', async () => {
    const prisma = prismaCom(null);
    expect(await resolvePsychosocialInstrument(prisma)).toBe('PSYCHOSOCIAL');
  });

  it('o diagnóstico do método ORGANIZACIONAL grava no motor psicossocial', async () => {
    const prisma = prismaCom({ slug: 'diagnostico-organizacional' });
    expect(await usesPsychosocialEngine(prisma, 'diagnostico-organizacional')).toBe(true);
  });

  it('o slug legado continua valendo mesmo com outro instrumento ativo', async () => {
    // Respostas antigas e instalações sem vínculo configurado não podem mudar de
    // motor por causa de um cadastro novo.
    const prisma = prismaCom({ slug: 'diagnostico-organizacional' });
    expect(await usesPsychosocialEngine(prisma, 'PSYCHOSOCIAL')).toBe(true);
  });

  it('diagnóstico de outro método NÃO entra no motor psicossocial', async () => {
    const prisma = prismaCom({ slug: 'diagnostico-organizacional' });
    expect(await usesPsychosocialEngine(prisma, 'essencial')).toBe(false);
    expect(await usesPsychosocialEngine(prisma, 'PRE_DIAGNOSTIC')).toBe(false);
  });
});
