import dotenv from 'dotenv';
import { MinerUConfig, MinerUDefaultConfig } from './knowledgeImport/MinerUClient';
dotenv.config();

export interface AppConfig {
  kafka: {
    enabled: boolean;
    brokers: string[];
    ssl?: boolean;
    sasl?: {
      mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
      username: string;
      password: string;
    };
  };
  MinerU: MinerUConfig
}

export const app_config: AppConfig = {
  kafka: {
    enabled: process.env.KAFKA_ENABLED === 'true',
    brokers: process.env.KAFKA_BROKERS
      ? process.env.KAFKA_BROKERS.split(',')
      : ['kafka:9092'],
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_SASL_MECHANISM &&
      process.env.KAFKA_SASL_USERNAME &&
      process.env.KAFKA_SASL_PASSWORD
      ? {
        mechanism: process.env.KAFKA_SASL_MECHANISM as 'plain' |
          'scram-sha-256' |
          'scram-sha-512',
        username: process.env.KAFKA_SASL_USERNAME,
        password: process.env.KAFKA_SASL_PASSWORD,
      }
      : undefined,
  },
  MinerU: {
    ...MinerUDefaultConfig
  }
};

