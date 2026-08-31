/**
 * Erro de API com rastro, e o repasse ao servidor do que ele não enxerga.
 *
 * O portal e o super admin tinham 157 pontos que engoliam o erro
 * (`catch { setStatus("error") }`) e nenhuma linha de log. A API já registra
 * tudo que CHEGA nela; o que faltava era isto:
 *   - amarrar o erro que o usuário viu à linha exata do servidor;
 *   - contar ao servidor o que ele não pode saber sozinho (falha de rede, em
 *     que a requisição nunca chegou, e tela que quebrou no navegador).
 */

/** Erro de chamada à API, com o suficiente para investigar depois. */
export class ApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;

  constructor(message: string, status: number, requestId: string | null) {
    // O código entra na MENSAGEM porque é ela que a tela mostra: o usuário lê
    // o código em voz alta e `crivo-logs.sh lead <código>` acha a linha.
    super(requestId ? `${message} (código: ${requestId})` : message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

/** Id curto de correlação — a API adota o que vier no header `x-request-id`. */
export function newRequestId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    // Navegador antigo ou contexto sem crypto: id fraco serve, é só correlação.
    return Math.random().toString(16).slice(2, 10);
  }
}

export type ClientErrorReport = {
  app: 'portal' | 'superadm';
  screen: string;
  message: string;
  kind: 'rede' | 'tela';
  requestId?: string;
};

/**
 * Teto por carregamento de página. Uma tela em laço de render mandaria
 * milhares de linhas; o servidor tem throttle, mas o desperdício começa aqui.
 */
const MAX_REPORTS = 5;
let sent = 0;

/** Tela atual, para o log dizer ONDE aconteceu. */
export function currentScreen(): string {
  if (typeof window === 'undefined') return 'servidor';
  return `${window.location.pathname}${window.location.hash}`.slice(0, 200);
}

/**
 * Manda o relato ao servidor. Best-effort e silencioso: se falhar, a interface
 * não muda em nada — este caminho existe para diagnosticar, nunca para atrapalhar.
 */
export function reportClientError(base: string, report: ClientErrorReport): void {
  if (typeof window === 'undefined' || sent >= MAX_REPORTS || !base) return;
  sent += 1;
  try {
    void fetch(`${base}/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Corpo fechado: a API recusa campo extra (ValidationPipe). NUNCA vai
      // aqui corpo de requisição, token ou dado pessoal.
      body: JSON.stringify({
        app: report.app,
        screen: report.screen.slice(0, 200),
        message: report.message.slice(0, 300),
        kind: report.kind,
        ...(report.requestId ? { requestId: report.requestId } : {}),
      }),
      signal: AbortSignal.timeout(5000),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* nem o relato do erro pode gerar erro */
  }
}
