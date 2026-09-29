import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ActionPlansService } from './action-plans.service';

// Commit 83fd176 (Ajustes Finais de Homologação): "Responsável da ação —
// definir onde é cadastrado/selecionado e exigir antes da aprovação final".
// Modelo final de 25/09: a evidência esperada deixou de ser gate para aprovar;
// concluir exige evidência anexada ou justificativa validada.

function build(existing: Record<string, unknown>, evidencias: { kind: string; status: string }[] = []) {
  const updates: Record<string, unknown>[] = [];
  const tx = {
    evidence: { findMany: vi.fn(async () => evidencias) },
    actionItem: {
      findUnique: vi.fn(async () => existing),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { ...existing, ...data, evidences: [], sourceInstrument: null };
      }),
    },
    actionItemHistory: { create: vi.fn(async () => ({})) },
    // H-008: vínculo do responsável — usuários ativos e cadastro de colaboradores.
    user: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'u-ana' ? { id: 'u-ana', name: 'Ana Souza' } : null,
      ),
    },
    collaborator: {
      findMany: vi.fn(async () => [
        { role: 'Gerente de Operações', area: 'Operações', sector: null },
        { role: 'Analista de RH', area: null, sector: 'Recursos Humanos' },
      ]),
    },
  };
  const prisma = {
    forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    admin: {},
  };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const svc = new ActionPlansService(prisma as any, {} as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { svc, updates };
}

const sugerida = {
  id: 'i1',
  tenantId: 't1',
  planId: 'p1',
  point: 'Sobrecarga de trabalho',
  origin: 'questionário',
  action: 'Revisar carga',
  responsible: null,
  dueDate: null,
  status: 'SUGERIDA',
  expectedEvidence: null,
  reviewDate: null,
  exposedGroup: null,
  severity: null,
  probability: null,
  riskLevel: null,
  areaProcess: null,
  existingMeasure: null,
  indicator: null,
  objective: null,
  sourceInstrumentSlug: null,
  riskFactorSlug: null,
  riskProbability: null,
  riskSeverity: null,
  suggestionKey: null,
  cycleId: null,
  createdAt: new Date('2026-09-16T12:00:00Z'),
  updatedAt: new Date('2026-09-16T12:00:00Z'),
};

describe('aprovar uma ação exige responsável (83fd176; evidência esperada opcional desde 25/09)', () => {
  it('recusa aprovar sem responsável', async () => {
    const { svc, updates } = build(sugerida);
    await expect(svc.updateItem('t1', 'i1', { status: 'APROVADA' }, 'RH')).rejects.toThrow(BadRequestException);
    await expect(svc.updateItem('t1', 'i1', { status: 'APROVADA' }, 'RH')).rejects.toThrow(/Responsável/);
    expect(updates).toHaveLength(0);
  });

  it('aprova com responsável vinculado a CARGO e SEM evidência esperada (não é mais gate)', async () => {
    const { svc, updates } = build(sugerida);
    await svc.updateItem(
      't1', 'i1',
      { status: 'APROVADA', responsibleType: 'CARGO', responsible: 'gerente de operações' },
      'RH',
    );
    expect(updates).toHaveLength(1);
    // Grava a grafia do cadastro, não a digitada.
    expect(updates[0]).toMatchObject({ status: 'APROVADA', responsible: 'Gerente de Operações', responsibleType: 'CARGO' });
  });

  // H-008 (decisão CRIVO 28/09/2026): texto livre sem vínculo não aprova.
  it('recusa aprovar com responsável só em texto livre (sem vínculo)', async () => {
    const { svc, updates } = build({ ...sugerida, responsible: 'RH + Gestores' });
    await expect(svc.updateItem('t1', 'i1', { status: 'APROVADA' }, 'RH')).rejects.toThrow(/vincule o responsável/);
    expect(updates).toHaveLength(0);
  });

  it('USUARIO grava o id e o nome do usuário ativo', async () => {
    const { svc, updates } = build(sugerida);
    await svc.updateItem('t1', 'i1', { status: 'APROVADA', responsibleType: 'USUARIO', responsibleUserId: 'u-ana' }, 'RH');
    expect(updates[0]).toMatchObject({ responsibleType: 'USUARIO', responsibleUserId: 'u-ana', responsible: 'Ana Souza' });
  });

  it('USUARIO inexistente/inativo é recusado', async () => {
    const { svc } = build(sugerida);
    await expect(
      svc.updateItem('t1', 'i1', { responsibleType: 'USUARIO', responsibleUserId: 'u-x' }, 'RH'),
    ).rejects.toThrow(/não encontrado ou inativo/);
  });

  it('ÁREA precisa existir no cadastro (área ou setor)', async () => {
    const ok = build(sugerida);
    await ok.svc.updateItem('t1', 'i1', { responsibleType: 'AREA', responsible: 'Recursos Humanos' }, 'RH');
    expect(ok.updates[0]).toMatchObject({ responsibleType: 'AREA', responsible: 'Recursos Humanos' });
    const nao = build(sugerida);
    await expect(
      nao.svc.updateItem('t1', 'i1', { responsibleType: 'AREA', responsible: 'Financeiro' }, 'RH'),
    ).rejects.toThrow(/não está no cadastro/);
  });

  it('EXTERNO aceita texto livre; EXCEÇÃO exige motivo', async () => {
    const ext = build(sugerida);
    await ext.svc.updateItem('t1', 'i1', { status: 'APROVADA', responsibleType: 'EXTERNO', responsible: 'Consultoria X' }, 'RH');
    expect(ext.updates[0]).toMatchObject({ responsibleType: 'EXTERNO', responsible: 'Consultoria X' });
    const exc = build(sugerida);
    await expect(
      exc.svc.updateItem('t1', 'i1', { responsibleType: 'EXCECAO', responsible: 'Comitê ad hoc' }, 'RH'),
    ).rejects.toThrow(/motivo da exceção/);
    const excOk = build(sugerida);
    await excOk.svc.updateItem(
      't1', 'i1',
      { status: 'APROVADA', responsibleType: 'EXCECAO', responsible: 'Comitê ad hoc', responsibleReason: 'Sem cargo fixo' },
      'RH',
    );
    expect(excOk.updates[0]).toMatchObject({ responsibleType: 'EXCECAO', responsibleReason: 'Sem cargo fixo' });
  });

  it('ação aprovada ANTES da regra (texto legado) continua editável', async () => {
    const { svc, updates } = build({ ...sugerida, status: 'APROVADA', responsible: 'RH + Gestores' });
    await svc.updateItem('t1', 'i1', { indicator: 'Horas extras' }, 'RH');
    expect(updates).toHaveLength(1);
  });

  it('trocar só o texto de um item vinculado a cargo desfaz o vínculo', async () => {
    const { svc, updates } = build({ ...sugerida, responsible: 'Gerente de Operações', responsibleType: 'CARGO' });
    await svc.updateItem('t1', 'i1', { responsible: 'Outra pessoa' }, 'RH');
    expect(updates[0]).toMatchObject({ responsible: 'Outra pessoa', responsibleType: null });
  });

  it('outros status (ex.: descartar) não exigem os campos', async () => {
    const { svc, updates } = build(sugerida);
    await svc.updateItem('t1', 'i1', { status: 'NAO_ADOTADA' }, 'RH');
    expect(updates).toHaveLength(1);
  });
});

describe('concluir exige evidência anexada ou justificativa validada (modelo final 25/09)', () => {
  const emAndamento = { ...sugerida, status: 'EM_ANDAMENTO', responsible: 'RH' };

  it('recusa concluir sem nenhuma evidência', async () => {
    const { svc, updates } = build(emAndamento);
    await expect(svc.updateItem('t1', 'i1', { status: 'CONCLUIDA' }, 'RH')).rejects.toThrow(
      /anexe uma evidência ou registre uma justificativa/,
    );
    expect(updates).toHaveLength(0);
  });

  it('recusa concluir só com evidência rejeitada ou substituída', async () => {
    const { svc } = build(emAndamento, [
      { kind: 'ata', status: 'REJEITADA' },
      { kind: 'documento', status: 'SUBSTITUIDA' },
    ]);
    await expect(svc.updateItem('t1', 'i1', { status: 'CONCLUIDA' }, 'RH')).rejects.toThrow(BadRequestException);
  });

  it('conclui com evidência anexada, mesmo aguardando validação', async () => {
    const { svc, updates } = build(emAndamento, [{ kind: 'ata', status: 'ENVIADA' }]);
    await svc.updateItem('t1', 'i1', { status: 'CONCLUIDA' }, 'RH');
    expect(updates[0]).toMatchObject({ status: 'CONCLUIDA' });
  });

  it('justificativa só vale depois de validada', async () => {
    const pendente = build(emAndamento, [{ kind: 'justificativa', status: 'ENVIADA' }]);
    await expect(pendente.svc.updateItem('t1', 'i1', { status: 'CONCLUIDA' }, 'RH')).rejects.toThrow(BadRequestException);
    const validada = build(emAndamento, [{ kind: 'justificativa', status: 'APROVADA' }]);
    await validada.svc.updateItem('t1', 'i1', { status: 'CONCLUIDA' }, 'RH');
    expect(validada.updates[0]).toMatchObject({ status: 'CONCLUIDA' });
  });

  it('ação já concluída continua editável (a regra é da transição)', async () => {
    const { svc, updates } = build({ ...emAndamento, status: 'CONCLUIDA' });
    await svc.updateItem('t1', 'i1', { status: 'REAVALIADA', indicator: 'Horas extras' }, 'RH');
    expect(updates).toHaveLength(1);
  });
});
