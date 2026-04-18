/**
 * 配置模块入口
 * 导出所有配置服务和类型
 */

// ==================== 类型导出 ====================
export type {
  // 应用配置类型
  AppConfig,
  LogConfig,
  CorsConfig,
  RateLimitConfig,
  CacheConfig,
} from './app.config.js';

export type {
  // 数据库配置类型
  DatabaseConfig,
  PrismaConfig,
} from './database.config.js';

export type {
  // 存储配置类型
  StorageConfig,
  StorageType,
} from './storage.config.js';

// ==================== 服务导出 ====================
export { AppConfigService } from './app.config.js';
export { DatabaseConfigService } from './database.config.js';

// ==================== 配置对象导出 ====================
export { default as appConfig } from './app.config.js';
export { default as databaseConfig } from './database.config.js';
export { default as storageConfig } from './storage.config.js';

// ==================== 配置工厂函数 ====================
export { createDatabaseConfig } from './database.config.js';

// ==================== 统一配置接口 ====================
/**
 * 数据库配置接口（简化版）
 */
export interface DatabaseConfigSimple {
  url: string;
}

/**
 * 应用配置接口（简化版）
 */
export interface AppConfigSimple {
  port: number;
  nodeEnv: string;
}

/**
 * 存储配置接口（简化版）
 */
export interface StorageConfigSimple {
  type: 'local' | 's3' | 'garage';
  basePath?: string;
  bucket?: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
}

/**
 * 默认配置导出
 * 用于 ConfigModule.forRoot() 的 load 选项
 */
export default () => ({
  app: {
    port: parseInt(process.env['PORT'] || '3002', 10),
    nodeEnv: process.env['NODE_ENV'] || 'development',
  } as AppConfigSimple,
  database: {
    url: process.env['DATABASE_URL'] || '',
  } as DatabaseConfigSimple,
  storage: {
    type: (process.env['STORAGE_TYPE'] as StorageConfigSimple['type']) || 'local',
    basePath: process.env['STORAGE_BASE_PATH'] || './uploads',
    bucket: process.env['STORAGE_BUCKET'],
    endpoint: process.env['STORAGE_ENDPOINT'],
    accessKey: process.env['STORAGE_ACCESS_KEY'],
    secretKey: process.env['STORAGE_SECRET_KEY'],
  } as StorageConfigSimple,
});
