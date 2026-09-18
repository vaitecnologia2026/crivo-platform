import { describe, expect, it, vi } from 'vitest';
import { perfilDaOrganizacao } from './psychosocial-action-plans';

// Homologação 17/09 (jornada, item 10): "Refinar qualidade e contextualização"
// da IA do Plano de Evolução. O prompt passa a levar o perfil da organização —
// porte, modelo de trabalho, setor, solução e diagnóstico aplicado.

function deps(overrides: Record<string, unknown> = {}) {
  const admin = {
    organization: { findUnique: vi.fn(async () => ({ name: 'Essencial Teste', establishment: 'Matriz', employeesCount: '48', workModel: 'híbrido' })) },
    tenant: { findFirst: vi.fn(async () => ({ id: 't1' })) },
    platformLead: { findFirst: vi.fn(async () => ({ segment: 'Comércio varejista de vestuário', employeesCount: '51-200' })) },
    contract: { findFirst: vi.fn(async () => ({ productId: 'p1' })) },
    product: { findUnique: vi.fn(async () => ({ name: 'CRIVO Diagnóstico Essencial' })) },
    diagnosticInstrument: { findUnique: vi.fn(async () => ({ name: 'Diagnóstico Essencial' })) },
    ...overrides,
  };
  return { prisma: { admin } as never, aiSettings: {} as never };
}

describe('perfilDaOrganizacao', () => {
  it('monta o perfil com setor, porte, modelo, solução e diagnóstico', async () => {
    const txt = await perfilDaOrganizacao(deps(), 'org-1', 'diagnostico-essencial');
    expect(txt.split('\n')).toEqual([
      '- Organização: Essencial Teste',
      '- Setor / atividade (CNAE): Comércio varejista de vestuário',
      '- Porte: 48 colaborador(es)',
      '- Modelo de trabalho: híbrido',
      '- Unidade/estabelecimento avaliado: Matriz',
      '- Solução contratada: CRIVO Diagnóstico Essencial',
      '- Diagnóstico aplicado: Diagnóstico Essencial',
    ]);
  });

  it('usa o porte do lead quando a organização não informou', async () => {
    const d = deps({ organization: { findUnique: vi.fn(async () => ({ name: 'X', establishment: null, employeesCount: null, workModel: null })) } });
    expect(await perfilDaOrganizacao(d, 'org-1', 'diagnostico-essencial')).toContain('- Porte: 51-200 colaborador(es)');
  });

  it('falha em qualquer leitura → perfil vazio (a geração segue)', async () => {
    const d = deps({ organization: { findUnique: vi.fn(async () => { throw new Error('db'); }) } });
    expect(await perfilDaOrganizacao(d, 'org-1', 'x')).toBe('');
  });
});
