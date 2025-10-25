import winston, { level } from 'winston';
import { ElasticsearchTransport } from './elasticsearch-transport.js';

const createLoggerWithPrefix = (prefix: string) => {
  const consoleFormat = winston.format.printf(
    ({ level, message, label, timestamp, meta }) => {
      const metaStr =
        meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `[${label}] ${message}${metaStr}`;
    },
  );

  const fileFormat = winston.format.combine(
    winston.format.label({ label: prefix }),
    winston.format.timestamp(),
    winston.format.json(),
  );

  const transports: any[] = [
    new winston.transports.Console({
      level: process.env['SYSTEM_LOG_LEVEL'] || 'info',
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: 'combined.log',
      format: fileFormat,
    }),
  ];

  // Add Elasticsearch transport if enabled
  if (process.env['ELASTICSEARCH_LOGGING_ENABLED'] === 'true') {
    const elasticsearchTransport = new ElasticsearchTransport({
      level:
        process.env['ELASTICSEARCH_LOG_LEVEL'] ||
        process.env['SYSTEM_LOG_LEVEL'] ||
        'info',
      elasticsearchUrl:
        process.env['ELASTICSEARCH_URL'] || 'http://localhost:9200',
      indexName: process.env['ELASTICSEARCH_LOG_INDEX'] || 'logs',
      indexPattern:
        process.env['ELASTICSEARCH_LOG_INDEX_PATTERN'] || 'logs-YYYY.MM.DD',
    });
    transports.push(elasticsearchTransport);
  }

  const logger = winston.createLogger({
    format: winston.format.combine(
      winston.format.label({ label: prefix }),
      winston.format.timestamp(),
    ),
    transports,
  });

  // Override log methods to support second parameter as any object
  const originalLog = logger.log.bind(logger);

  (logger as any).log = function (
    level: string,
    message: string,
    meta?: any,
    callback?: any,
  ) {
    if (meta && typeof meta === 'object') {
      return originalLog(level, message, { meta }, callback);
    }
    return originalLog(level, message, meta, callback);
  };

  // Override convenience methods
  ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'].forEach(
    (methodName) => {
      const originalMethod = (logger as any)[methodName].bind(logger);
      (logger as any)[methodName] = function (
        message: string,
        meta?: any,
        callback?: any,
      ) {
        if (meta && typeof meta === 'object') {
          return originalMethod(message, { meta }, callback);
        }
        return originalMethod(message, meta, callback);
      };
    },
  );

  return logger;
};

export default createLoggerWithPrefix;
