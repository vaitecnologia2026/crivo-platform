import { describe, expect, it } from 'vitest';
import { ROLE_LABELS, type ActionPlanData, type CampaignSummary, type LibraryItemData, type UserSummary } from '@crivo/types';
import type { ReportEmissionMeta } from './api';
import { buildSearchIndex, normalize, searchPortal, type SearchSources } from './portal-search';

const base: SearchSources = {
  routes: [
    { route: 'dashboard', label: 'Visão Geral', group: 'Portal' },
    { route: 'relatorios', label: 'Plano de Evolução', group: 'Portal' },
    { route: 'icd', label: 'Liderança', group: 'Programas' },
  ],
  plans: null,
  emissions: null,
  campaigns: null,
  users: null,
  library: null,
  notifications: null,
};

const plans = [
  {
    id: 'p1',
    title: 'Plano NR-1',
    items: [
      {
        id: 'i1',
        action: 'Instituir revisão mensal de capacidade',
        point: 'Sobrecarga de trabalho',
        origin: null,
        objective: null,
        status: 'APROVADA',
        responsible: 'RH + Gestores',
        // Como a API grava o prazo: meio-dia de Brasília.
        dueDate: '2026-11-22T15:00:00.000Z',
        scopeGhe: null,
        evidences: [{ id: 'e1', title: 'Ata da reunião', status: 'REJEITADA', fileName: 'ata.pdf', note: null }],
      },
    ],
  },
] as unknown as ActionPlanData[];

describe('busca global do portal', () => {
  it('ignora acento e maiúscula', () => {
    expect(normalize('  Ação   AVALIAÇÃO ')).toBe('acao avaliacao');
  });

  it('consulta vazia lista só as telas, na ordem do menu', () => {
    const idx = buildSearchIndex({ ...base, plans });
    const g = searchPortal(idx, '');
    expect(g.map((x) => x.category)).toEqual(['Tela']);
    expect(g[0].entries.map((e) => e.label)).toEqual(['Visão Geral', 'Plano de Evolução', 'Liderança']);
  });

  it('ação, evidência e prazo em dd/mm/aaaa (mesmo formato do Plano de Evolução)', () => {
    const idx = buildSearchIndex({ ...base, plans });
    const g = searchPortal(idx, 'capacidade');
    const acao = g.find((x) => x.category === 'Ação')!.entries[0];
    expect(acao).toMatchObject({ route: 'relatorios', label: 'Instituir revisão mensal de capacidade' });
    expect(acao.context).toBe('Aprovada · RH + Gestores · prazo 22/11/2026');
    const ev = searchPortal(idx, 'ata reuniao').find((x) => x.category === 'Evidência')!.entries[0];
    expect(ev).toMatchObject({ route: 'evidencias', context: 'Rejeitada · ação: Instituir revisão mensal de capacidade' });
  });

  it('todas as palavras precisam casar, em qualquer ordem, inclusive no contexto', () => {
    const idx = buildSearchIndex({ ...base, plans });
    expect(searchPortal(idx, 'gestores capacidade').some((x) => x.category === 'Ação')).toBe(true);
    expect(searchPortal(idx, 'capacidade inexistente')).toEqual([]);
    // O ponto (fator) entra na busca mesmo sem aparecer na linha.
    expect(searchPortal(idx, 'sobrecarga').some((x) => x.category === 'Ação')).toBe(true);
  });

  it('rótulo que começa com a consulta vem antes', () => {
    const idx = buildSearchIndex({
      ...base,
      routes: [
        { route: 'a', label: 'Relatórios e Dossiês', group: 'Portal' },
        { route: 'b', label: 'Dossiê técnico', group: 'Portal' },
      ],
    });
    expect(searchPortal(idx, 'dossie')[0].entries.map((e) => e.route)).toEqual(['b', 'a']);
  });

  it('corta por categoria mas informa o total', () => {
    const users = Array.from({ length: 9 }, (_, i) => ({
      id: `u${i}`,
      name: `Ana ${i}`,
      email: `ana${i}@x.com`,
      role: 'RH',
      active: true,
    })) as unknown as UserSummary[];
    const g = searchPortal(buildSearchIndex({ ...base, users }), 'ana', 6);
    expect(g[0]).toMatchObject({ category: 'Usuário', total: 9 });
    expect(g[0].entries).toHaveLength(6);
    expect(g[0].entries[0].context).toBe(`ana0@x.com · ${ROLE_LABELS.RH}`);
  });

  it('relatório, campanha, academia e aviso levam cada um à sua tela', () => {
    const idx = buildSearchIndex({
      ...base,
      emissions: [{ id: 'r1', title: 'Dossiê Técnico', emissionNumber: 2, createdAt: '2026-09-23T15:00:00Z', status: 'EMITIDA', generatedBy: null, type: 'dossie_tecnico' }] as unknown as ReportEmissionMeta[],
      campaigns: [{ id: 'c1', name: 'Ciclo 2026.2', status: 'OPEN', respondentes: 19, sector: null, description: null }] as unknown as CampaignSummary[],
      library: [{ id: 'l1', title: 'Trilha NR-1', kind: 'VIDEO', description: null }] as unknown as LibraryItemData[],
      notifications: [{ id: 'n1', severity: 'high', kind: 'Trava', title: 'Plano "X" ainda não validado', detail: null, route: 'relatorios', at: null }],
    });
    const rota = (q: string, cat: string) => searchPortal(idx, q).find((x) => x.category === cat)!.entries[0].route;
    expect(rota('dossie tecnico', 'Relatório')).toBe('documentos');
    expect(rota('2026.2', 'Campanha')).toBe('campanhas');
    expect(rota('trilha', 'Academia')).toBe('biblioteca');
    expect(rota('validado', 'Aviso')).toBe('notificacoes');
  });
});
