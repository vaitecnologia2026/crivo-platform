/**
 * CT1 (Caderno §7/P0-b) — o contrato como configuração REAL do cliente: o prazo
 * (endDate / accessDays) passa a valer no acesso, não só a ser armazenado.
 *
 * Regra CONSERVADORA e permissiva por padrão:
 *  - Só um contrato ATIVO com prazo EXPLÍCITO e VENCIDO bloqueia.
 *  - Sem contrato, contrato não-ATIVO, ou sem prazo definido → acesso liberado.
 *  - `endDate`: bloqueia após a data. `accessDays`: bloqueia após
 *    startDate + N dias (só quando há startDate).
 */

const DAY_MS = 86_400_000;

export type ContractAccessInput = {
  status: 'RASCUNHO' | 'ATIVO' | 'SUSPENSO' | 'ENCERRADO';
  startDate: Date | null;
  endDate: Date | null;
  accessDays: number | null;
};

export type ContractAccessState = {
  allowed: boolean;
  reason?: 'expired_end_date' | 'expired_access_days' | 'contract_suspended' | 'contract_closed';
};

export function contractAccessState(
  contract: ContractAccessInput | null | undefined,
  now: Date,
): ContractAccessState {
  if (!contract) return { allowed: true };

  // SUSPENSO/ENCERRADO barram por si só. Antes o contrato só valia quando ATIVO:
  // suspender ou encerrar no Super Admin não revogava acesso nenhum (o cliente
  // seguia entrando até o tenant ser desativado à mão).
  if (contract.status === 'SUSPENSO') return { allowed: false, reason: 'contract_suspended' };
  if (contract.status === 'ENCERRADO') return { allowed: false, reason: 'contract_closed' };

  // RASCUNHO ainda não ativou nada — permissivo (pré-contrato).
  if (contract.status !== 'ATIVO') return { allowed: true };

  if (contract.endDate && now.getTime() > contract.endDate.getTime()) {
    return { allowed: false, reason: 'expired_end_date' };
  }

  if (contract.accessDays && contract.accessDays > 0 && contract.startDate) {
    const expiry = contract.startDate.getTime() + contract.accessDays * DAY_MS;
    if (now.getTime() > expiry) return { allowed: false, reason: 'expired_access_days' };
  }

  return { allowed: true };
}
