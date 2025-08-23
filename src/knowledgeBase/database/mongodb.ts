/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { MongoClient, Db } from 'mongodb';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('MongoDB');

interface MongoDBConfig {
  uri: string;
  dbName: string;
}

class MongoDBConnection {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: MongoDBConfig;

  constructor(config: MongoDBConfig) {
    this.config = config;
  }

  async connect(): Promise<Db> {
    try {
      if (!this.client) {
        this.client = new MongoClient(this.config.uri);
        await this.client.connect();
        this.db = this.client.db(this.config.dbName);
        logger.info(`Connected to MongoDB database: ${this.config.dbName}`);
      }
      return this.db!;
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
        logger.info('Disconnected from MongoDB');
      }
    } catch (error) {
      logger.error('Failed to disconnect from MongoDB:', error);
      throw error;
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  getClient(): MongoClient | null {
    return this.client;
  }
}

export default MongoDBConnection;
