import winston, { level } from 'winston';
import { ElasticsearchTransport } from './elasticsearch-transport';

const createLoggerWithPrefix = (prefix: string) => {
  const consoleFormat = winston.format.printf(({ level, message, label, timestamp }) => {
    return `[${label}] ${message}`;
  });

  const fileFormat = winston.format.combine(
    winston.format.label({ label: prefix }),
    winston.format.timestamp(),
    winston.format.json()
  );

  const transports: any[] = [
    new winston.transports.Console({
      level: process.env.SYSTEM_LOG_LEVEL,
      format: consoleFormat
    }),
    new winston.transports.File({
      filename: 'combined.log',
      format: fileFormat
    }),
  ];

  // Add Elasticsearch transport if enabled
  if (process.env.ELASTICSEARCH_LOGGING_ENABLED === 'true') {
    const elasticsearchTransport = new ElasticsearchTransport({
      level: process.env.ELASTICSEARCH_LOG_LEVEL || process.env.SYSTEM_LOG_LEVEL || 'info',
      elasticsearchUrl: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      indexName: process.env.ELASTICSEARCH_LOG_INDEX || 'logs',
      indexPattern: process.env.ELASTICSEARCH_LOG_INDEX_PATTERN || 'logs-YYYY.MM.DD',
    });
    transports.push(elasticsearchTransport);
  }

  return winston.createLogger({
    format: winston.format.combine(
      winston.format.label({ label: prefix }),
      winston.format.timestamp(),
    ),
    transports,
  });
};

export default createLoggerWithPrefix;
