/**
 * 数据库配置
 * 提供数据库连接和 ORM 配置
 */
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
    /** 数据库连接 URL */
    url: string;
    /** 连接池大小 */
    poolSize: number;
    /** 连接超时时间 (毫秒) */
    timeout: number;
    /** 是否启用日志 */
    logging: boolean;
}

/**
 * Prisma 配置选项
 */
export interface PrismaConfig {
    datasources: {
        db: {
            url: string;
        };
    };
    log: Array<{
        emit: "stdout" | "event";
        level: "query" | "info" | "warn" | "error";
    }>;
}

@Injectable()
export class DatabaseConfigService {
    constructor(private readonly configService: ConfigService) {}

    /**
     * 获取数据库配置
     */
    getDatabaseConfig(): DatabaseConfig {
        return {
            url: this.configService.get<string>("DATABASE_URL")!,
            poolSize: parseInt(
                this.configService.get<string>("DATABASE_POOL_SIZE") || "10",
                10
            ),
            timeout: parseInt(
                this.configService.get<string>("DATABASE_TIMEOUT") || "30000",
                10
            ),
            logging: this.configService.get<string>("NODE_ENV") === "development",
        };
    }

    /**
     * 获取 Prisma 客户端配置
     */
    getPrismaConfig(): PrismaConfig {
        const config = this.getDatabaseConfig();
        const isDev = this.configService.get<string>("NODE_ENV") === "development";

        return {
            datasources: {
                db: {
                    url: config.url,
                },
            },
            log: isDev
                ? [
                      { emit: "stdout", level: "query" },
                      { emit: "stdout", level: "info" },
                      { emit: "stdout", level: "warn" },
                      { emit: "stdout", level: "error" },
                  ]
                : [{ emit: "stdout", level: "error" }],
        };
    }

    /**
     * 获取数据库 URL
     */
    getDatabaseUrl(): string {
        return this.configService.get<string>("DATABASE_URL")!;
    }

    /**
     * 检查是否启用数据库日志
     */
    isLoggingEnabled(): boolean {
        return this.configService.get<string>("NODE_ENV") === "development";
    }
}

/**
 * 数据库配置工厂函数
 * 用于在模块外获取配置
 */
export function createDatabaseConfig(
    configService: ConfigService
): DatabaseConfig {
    return {
        url: configService.get<string>("DATABASE_URL")!,
        poolSize: parseInt(
            configService.get<string>("DATABASE_POOL_SIZE") || "10",
            10
        ),
        timeout: parseInt(
            configService.get<string>("DATABASE_TIMEOUT") || "30000",
            10
        ),
        logging: configService.get<string>("NODE_ENV") === "development",
    };
}

export default DatabaseConfigService;
