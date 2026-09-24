import { describe, expect, it, vi } from 'vitest';
import { ActionPlansService } from './action-plans.service';

// O sino, a central de Notificações e a busca do portal leem o plano a cada
// login, volta de foco e Ctrl+K. A listagem normal (GET /action-plans) roda
// antes a geração automática do plano — pode chamar a IA e grava ação e
// histórico. Leitura de barra não pode disparar isso: `gerar: false` só lê.

function build() {
  const gerarPlanoAutomatico = vi.fn(async () => 0);
  const findMany = vi.fn(async () => []);
  const prisma = {
    forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn({ actionPlan: { findMany } })),
  };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const svc = new ActionPlansService(prisma as any, { gerarPlanoAutomatico } as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { svc, gerarPlanoAutomatico, findMany };
}

describe('listagem do plano: só leitura para a barra do portal', () => {
  it('gerar: false lê os planos sem disparar a geração automática', async () => {
    const { svc, gerarPlanoAutomatico, findMany } = build();
    await expect(svc.list('t1', { gerar: false })).resolves.toEqual([]);
    expect(gerarPlanoAutomatico).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledOnce();
  });

  it('sem a opção, continua como antes: gera e depois lê', async () => {
    const { svc, gerarPlanoAutomatico, findMany } = build();
    await svc.list('t1');
    expect(gerarPlanoAutomatico).toHaveBeenCalledWith('t1');
    expect(findMany).toHaveBeenCalledOnce();
  });
});
