import pino from 'pino';
import { Writable } from 'stream';
import pg from 'pg';
import pinoPretty from 'pino-pretty';

export type Logger = pino.Logger;

export interface SharedLoggerOptions {
  name: string;
  level?: string;
  enablePretty?: boolean;
  pgConnection?: string;
  pgTable?: string;
}

let rootLogger: pino.Logger | undefined;
let pgPool: pg.Pool | undefined;
let initPromise: Promise<unknown> | undefined;
let flushTimer: ReturnType<typeof setInterval> | undefined;

const { Pool } = pg;

const VALID_TABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function sanitizeTableName(name: string): string {
  if (!VALID_TABLE_NAME.test(name)) {
    throw new Error(`Invalid log table name: "${name}". Only alphanumeric characters and underscores are allowed.`);
  }
  return name;
}

async function ensureLogTable(pool: pg.Pool, tableName: string): Promise<void> {
  const safeName = sanitizeTableName(tableName);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${safeName} (
      time timestamp NOT NULL,
      level varchar NOT NULL,
      module varchar DEFAULT '',
      msg text,
      extra jsonb
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_${safeName}_time ON ${safeName} (time)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_${safeName}_level ON ${safeName} (level)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_${safeName}_module ON ${safeName} (module)`);
}

export async function initLogger(options?: SharedLoggerOptions, verbose?: boolean): Promise<pino.Logger> {
  let level: string | undefined;
  let name = 'app';
  let enablePretty = true;
  let pgConnection: string | undefined;
  let pgTable = 'app_logs';

  if (options && typeof options === 'object') {
    level = options.level;
    name = options.name || 'app';
    enablePretty = options.enablePretty !== false;
    pgConnection = options.pgConnection ?? process.env.LOG_DB_URL;
    pgTable = options.pgTable || process.env.LOG_DB_TABLE || 'app_logs';
  } else if (typeof options === 'string') {
    level = options;
    pgConnection = process.env.LOG_DB_URL;
    pgTable = process.env.LOG_DB_TABLE || 'app_logs';
  } else {
    pgConnection = process.env.LOG_DB_URL;
    pgTable = process.env.LOG_DB_TABLE || 'app_logs';
  }

  if (pgConnection) {
    pgPool = new Pool({ connectionString: pgConnection });
    await ensureLogTable(pgPool, pgTable);
  }

  if (enablePretty && pgConnection) {
    const prettyStream = pinoPretty({ colorize: true }) as unknown as Writable;
    const pgStream = createPgStream(pgTable);
    const splitStream = new SplitStream([prettyStream, pgStream]);
    rootLogger = pino({ name, level: level || 'debug', timestamp: pino.stdTimeFunctions.isoTime, formatters: { level: (label) => ({ level: label }) } }, splitStream);
  } else if (enablePretty) {
    rootLogger = pino({ name, level: level || 'debug', timestamp: pino.stdTimeFunctions.isoTime, formatters: { level: (label) => ({ level: label }) }, transport: { target: 'pino-pretty', options: { colorize: true } } });
  } else if (pgConnection) {
    rootLogger = pino({ name, level: level || 'debug', timestamp: pino.stdTimeFunctions.isoTime, formatters: { level: (label) => ({ level: label }) } }, createPgStream(pgTable));
  } else {
    rootLogger = pino({ name, level: level || 'debug', timestamp: pino.stdTimeFunctions.isoTime, formatters: { level: (label) => ({ level: label }) } });
  }

  return rootLogger;
}

class SplitStream extends Writable {
  constructor(private streams: Writable[]) {
    super({ objectMode: false });
  }

  _write(chunk: string | Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    for (const stream of this.streams) {
      stream.write(chunk);
    }
    callback();
  }
}

interface LogEntry {
  time: string;
  level: string;
  module?: string;
  msg: string;
  [key: string]: unknown;
}

function createPgStream(tableName: string): Writable {
  let buffer: LogEntry[] = [];
  const flushInterval = 1000;
  const batchSize = 100;
  const safeName = sanitizeTableName(tableName);

  const flush = async () => {
    if (buffer.length === 0 || !pgPool) return;

    const entries = [...buffer];
    buffer = [];

    const client = await pgPool.connect();
    try {
      await client.query(
        `INSERT INTO ${safeName} (time, level, module, msg, extra)
         SELECT * FROM UNNEST($1::timestamp[], $2::varchar[], $3::varchar[], $4::text[], $5::jsonb[])`,
        [
          entries.map((e) => e.time),
          entries.map((e) => e.level),
          entries.map((e) => e.module || ''),
          entries.map((e) => e.msg),
          entries.map((e) =>
            JSON.stringify(Object.fromEntries(
              Object.entries(e).filter(([k]) => !['time', 'level', 'module', 'msg'].includes(k))
            ))
          ),
        ],
      );
    } catch (error) {
      console.error('Failed to write logs to PostgreSQL:', error);
    } finally {
      client.release();
    }
  };

  flushTimer = setInterval(flush, flushInterval);

  return new Writable({
    write(chunk: string | Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
      try {
        const entry: LogEntry = JSON.parse(chunk.toString());
        buffer.push(entry);
        if (buffer.length >= batchSize) {
          flush();
        }
        callback();
      } catch {
        callback();
      }
    },
  });
}

const noopLogger = pino({ name: 'noop', level: 'silent' });
const pendingLogs: Array<{ level: string; msg: string; args: unknown[] }> = [];

function flushPendingLogs(logger: pino.Logger) {
  for (const { level, msg, args } of pendingLogs) {
    (logger as pino.Logger & Record<string, (...args: unknown[]) => void>)[level](msg, ...args.slice(1));
  }
  pendingLogs.length = 0;
}

export function getLogger(name?: string): pino.Logger {
  if (!rootLogger) {
    if (!initPromise) {
      initPromise = initLogger().then((logger) => {
        rootLogger = logger;
        flushPendingLogs(logger);
      }).finally(() => {
        initPromise = undefined;
      });
    }
    const proxy = Object.create(noopLogger);
    proxy.info = (...args: unknown[]) => { pendingLogs.push({ level: 'info', msg: String(args[0]), args }); };
    proxy.error = (...args: unknown[]) => { pendingLogs.push({ level: 'error', msg: String(args[0]), args }); };
    proxy.warn = (...args: unknown[]) => { pendingLogs.push({ level: 'warn', msg: String(args[0]), args }); };
    proxy.debug = (...args: unknown[]) => { pendingLogs.push({ level: 'debug', msg: String(args[0]), args }); };
    proxy.trace = (...args: unknown[]) => { pendingLogs.push({ level: 'trace', msg: String(args[0]), args }); };
    return proxy as pino.Logger;
  }
  if (name) {
    return rootLogger.child({ module: name });
  }
  return rootLogger;
}

export function createChildLogger(parent: pino.Logger, bindings: Record<string, unknown>): pino.Logger {
  return parent.child(bindings);
}

export async function closePgPool(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = undefined;
  }
  if (pgPool) {
    await pgPool.end();
    pgPool = undefined;
  }
}

export { pino };
