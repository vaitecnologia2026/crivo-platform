import type { LoggerService, LogLevel } from '@nestjs/common';
import { inspect } from 'node:util';

/**
 * Logger da API — o formato que o arquivo do servidor precisa ter para ser útil.
 *
 * O `ConsoleLogger` do Nest 10 coloriza SEM checar se a saída é um terminal, e
 * `StandardOutput=append:/var/log/crivo-api.log` (systemd) grava os códigos ANSI
 * dentro do arquivo. Somado ao timestamp em formato local sem fuso
 * (`08/28/2026, 2:46:25 AM`, enquanto o nginx registra em UTC), o log ficava
 * caro de ler e impossível de correlacionar. Na versão 10.4 o `ConsoleLogger`
 * não expõe opção de cor (só `logLevels` e `timestamp`) e os extratores de
 * contexto são privados — não há o que sobrescrever com segurança. Daí uma
 * implementação própria de `LoggerService`, que são seis métodos triviais.
 *
 * Formato — uma linha por evento, greppável:
 *   2026-08-31T16:42:07.918Z ERROR [PreliminaryReports] <mensagem>
 *
 * Basta passar a instância ao `NestFactory.create({ logger })`: o Nest chama
 * `Logger.overrideLogger`, então os 15 `new Logger(...)` já espalhados pela API
 * passam a sair neste formato sem tocar em nenhum deles.
 */

/**
 * Contextos internos do Nest cujo nível `log` é dump de inicialização: 16.722
 * linhas por boot em produção, 2,5 MB por semana, afogando o que importa.
 *
 * Três guardas deliberados: some SÓ o nível `log` (um `warn` do RouterExplorer
 * sobre rota duplicada continua aparecendo); `NestFactory` e `NestApplication`
 * ficam de FORA, então o par "Starting…"/"successfully started" segue no arquivo
 * como prova de vida; e `LOG_BOOT=1` traz tudo de volta sem redeploy.
 */
const BOOT_NOISE = new Set(['InstanceLoader', 'RouterExplorer', 'RoutesResolver']);

const ORDER: Record<LogLevel, number> = {
  verbose: 10,
  debug: 20,
  log: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

function parseLevel(value: string | undefined): LogLevel {
  const v = (value ?? '').trim().toLowerCase();
  return v in ORDER ? (v as LogLevel) : 'log';
}

/**
 * Mensagem em uma linha só. Objeto vai por `inspect` — `String(obj)` daria
 * `[object Object]`, que é perda de informação silenciosa, exatamente o que
 * este logger existe para não fazer.
 */
function format(value: unknown): string {
  try {
    if (typeof value === 'string') return value.replace(/\s*\n\s*/g, ' ').trim();
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    const text = inspect(value, { depth: 3, breakLength: Infinity });
    return text.replace(/\s*\n\s*/g, ' ').trim();
  } catch {
    // Objeto circular ou getter que lança não pode derrubar a requisição.
    return String(value);
  }
}

export class CrivoLogger implements LoggerService {
  private min: number;

  constructor(minLevel: LogLevel = parseLevel(process.env.LOG_LEVEL)) {
    this.min = ORDER[minLevel];
  }

  /** O Nest chama isto quando o nível é configurado por fora. */
  setLogLevels(levels: LogLevel[]): void {
    this.min = levels.reduce((acc, l) => Math.min(acc, ORDER[l] ?? ORDER.log), ORDER.fatal);
  }

  log(message: unknown, ...rest: unknown[]): void {
    this.write('log', message, contextOf(rest));
  }

  warn(message: unknown, ...rest: unknown[]): void {
    this.write('warn', message, contextOf(rest));
  }

  debug(message: unknown, ...rest: unknown[]): void {
    this.write('debug', message, contextOf(rest));
  }

  verbose(message: unknown, ...rest: unknown[]): void {
    this.write('verbose', message, contextOf(rest));
  }

  fatal(message: unknown, ...rest: unknown[]): void {
    this.write('fatal', message, contextOf(rest));
  }

  /**
   * `error(message, stack?, context?)` — assinatura do Nest. O `Logger` interno
   * chega a passar `error(msg, undefined, 'Contexto')`, daí a limpeza dos
   * argumentos vazios antes de decidir quem é stack e quem é contexto.
   */
  error(message: unknown, ...rest: unknown[]): void {
    const params = rest.filter((p) => p !== undefined && p !== null);
    let stack: string | undefined;
    let context: string | undefined;
    if (params.length >= 2) {
      stack = typeof params[0] === 'string' ? params[0] : undefined;
      context = typeof params[1] === 'string' ? params[1] : undefined;
    } else if (params.length === 1 && typeof params[0] === 'string') {
      // Só é stack se tiver quebra de linha; senão é o contexto — é assim que
      // `this.log.error('mensagem', 'MeuServico')` continua funcionando.
      if (params[0].includes('\n')) stack = params[0];
      else context = params[0];
    }
    this.write('error', message, context, stack);
  }

  private write(level: LogLevel, message: unknown, context?: string, stack?: string): void {
    if (ORDER[level] < this.min) return;
    if (level === 'log' && context && BOOT_NOISE.has(context) && process.env.LOG_BOOT !== '1') return;

    // O filtro de exceção do Nest loga o ERRO CRU (`logger.error(exception)`).
    // Sem esta linha a pilha do 500 se perderia — a regressão mais cara que um
    // logger novo pode causar.
    const inherited = !stack && message instanceof Error ? message.stack : undefined;
    const trace = stack ?? inherited;

    const head = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${context ?? 'App'}] `;
    // Uma única chamada de write por evento: com stdout e stderr apontando para
    // o MESMO arquivo (unit do systemd), escrever em partes intercalaria linhas.
    const line = trace ? `${head}${format(message)}\n${trace}\n` : `${head}${format(message)}\n`;
    const out = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
    out.write(line);
  }
}

/** O Nest passa o contexto como último argumento string. */
function contextOf(rest: unknown[]): string | undefined {
  const last = rest[rest.length - 1];
  return typeof last === 'string' ? last : undefined;
}
