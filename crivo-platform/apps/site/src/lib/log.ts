/**
 * Log do site (serviço `crivo-lp`) no MESMO formato da API.
 *
 * O `next start` manda stdout/stderr para `/var/log/crivo-lp.log` (systemd), e
 * até aqui as rotas do site tinham `catch` vazio em quase todo caminho de
 * entrega: quando o lead não recebia o e-mail, não havia uma linha sequer
 * dizendo por quê. Como o formato é igual ao da API e as duas pontas carregam o
 * mesmo `req=`, dá para ler a jornada inteira de um lead em ordem.
 *
 *   2026-08-31T16:42:07.918Z WARN  [diagnostic-lead] req=8f2c1b ebook.http_error status=404
 */

type Level = 'INFO' | 'WARN' | 'ERROR';

function emit(level: Level, context: string, reqId: string, message: string): void {
  const line = `${new Date().toISOString()} ${level.padEnd(5)} [${context}] req=${reqId} ${message}`;
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

export function makeLogger(context: string, reqId: string) {
  return {
    info: (message: string) => emit('INFO', context, reqId, message),
    warn: (message: string) => emit('WARN', context, reqId, message),
    error: (message: string) => emit('ERROR', context, reqId, message),
  };
}

export type SiteLogger = ReturnType<typeof makeLogger>;

/** Motivo de uma exceção, em uma linha (o `name` distingue timeout de recusa). */
export function reasonOf(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

/** E-mail parcialmente oculto: o log fica semanas em disco. */
export function maskEmail(email?: string | null): string {
  if (!email) return '—';
  return email.replace(/^(.).*(@.*)$/, '$1***$2');
}

/** Telefone só com os últimos 4 dígitos. */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '—';
  return `***${String(phone).slice(-4)}`;
}

/**
 * Id de correlacao vindo de fora e dado nao confiavel: um valor com quebra
 * de linha forjaria linhas inteiras dentro do arquivo de log.
 */
export function safeReqId(value: string | null | undefined): string | null {
  return value && /^[A-Za-z0-9._-]{1,64}$/.test(value) ? value : null;
}
