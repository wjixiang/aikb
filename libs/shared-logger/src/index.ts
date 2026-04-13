import pino from 'pino';
import { Writable, Transform } from 'stream';
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

const { Pool } = pg;

export function initLogger(options?: SharedLoggerOptions, verbose?: boolean): pino.Logger {
  let level: string | undefined;
  let name = 'app';
  let enablePretty = true;
  let pgConnection: string | undefined;
  let pgTable = 'app_logs';

  if (options) {
    level = options.level;
    name = options.name || 'app';
    enablePretty = options.enablePretty !== false;
    pgConnection = options.pgConnection ?? process.env.LOG_DB_URL;
    pgTable = options.pgTable || process.env.LOG_DB_TABLE || 'app_logs';
  } else {
    pgConnection = process.env.LOG_DB_URL;
    pgTable = process.env.LOG_DB_TABLE || 'app_logs';
  }

  if (pgConnection) {
    pgPool = new Pool({ connectionString: pgConnection });
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

  const flush = async () => {
    if (buffer.length === 0 || !pgPool) return;

    const entries = [...buffer];
    buffer = [];

    const client = await pgPool.connect();
    try {
      await client.query(
        `INSERT INTO ${tableName} (time, level, module, msg, extra)
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

  setInterval(flush, flushInterval);

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

export function getLogger(name?: string): pino.Logger {
  if (!rootLogger) {
    initLogger();
  }
  if (name) {
    return rootLogger!.child({ module: name });
  }
  return rootLogger!;
}

export function createChildLogger(parent: pino.Logger, bindings: Record<string, unknown>): pino.Logger {
  return parent.child(bindings);
}

export async function closePgPool(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = undefined;
  }
}

export { pino };
