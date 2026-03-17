/**
 * 应用配置
 * 提供应用级别的配置项
 */
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * 应用配置接口
 */
export interface AppConfig {
    /** 运行环境 */
    env: string;
    /** 服务端口 */
    port: number;
    /** 服务主机 */
    host: string;
    /** API 前缀 */
    apiPrefix: string;
    /** API 版本 */
    apiVersion: string;
    /** 应用名称 */
    name: string;
    /** 应用版本 */
    version: string;
    /** 应用描述 */
    description: string;
}

/**
 * 日志配置接口
 */
export interface LogConfig {
    /** 日志级别 */
    level: "debug" | "info" | "warn" | "error";
    /** 日志格式 */
    format: "json" | "pretty";
}

/**
 * CORS 配置接口
 */
export interface CorsConfig {
    /** 允许的源 */
    origin: string | string[];
    /** 是否允许凭证 */
    credentials: boolean;
}

/**
 * 限流配置接口
 */
export interface RateLimitConfig {
    /** 是否启用限流 */
    enabled: boolean;
    /** 时间窗口 (毫秒) */
    windowMs: number;
    /** 最大请求数 */
    max: number;
}

/**
 * 缓存配置接口
 */
export interface CacheConfig {
    /** 是否启用缓存 */
    enabled: boolean;
    /** 默认 TTL (秒) */
    ttl: number;
}

@Injectable()
export class AppConfigService {
    constructor(private readonly configService: ConfigService) {}

    /**
     * 获取应用配置
     */
    getAppConfig(): AppConfig {
        return {
            env: this.configService.get<string>("NODE_ENV") || "development",
            port: parseInt(
                this.configService.get<string>("PORT") || "3000",
                10
            ),
            host: this.configService.get<string>("HOST") || "0.0.0.0",
            apiPrefix:
                this.configService.get<string>("API_PREFIX") || "api",
            apiVersion:
                this.configService.get<string>("API_VERSION") || "v1",
            name: "Case Hub",
            version: "1.0.0",
            description: "病历管理 NestJS 服务",
        };
    }

    /**
     * 获取日志配置
     */
    getLogConfig(): LogConfig {
        return {
            level:
                (this.configService.get<"debug" | "info" | "warn" | "error">(
                    "LOG_LEVEL"
                ) as "debug" | "info" | "warn" | "error") || "info",
            format:
                (this.configService.get<"json" | "pretty">(
                    "LOG_FORMAT"
                ) as "json" | "pretty") || "pretty",
        };
    }

    /**
     * 获取 CORS 配置
     */
    getCorsConfig(): CorsConfig {
        const origin = this.configService.get<string>("CORS_ORIGIN") || "*";
        return {
            origin: origin === "*" ? "*" : origin.split(","),
            credentials:
                this.configService.get<string>("CORS_CREDENTIALS") === "true",
        };
    }

    /**
     * 获取限流配置
     */
    getRateLimitConfig(): RateLimitConfig {
        return {
            enabled:
                this.configService.get<string>("RATE_LIMIT_ENABLED") !==
                "false",
            windowMs: parseInt(
                this.configService.get<string>("RATE_LIMIT_WINDOW_MS") ||
                    "60000",
                10
            ),
            max: parseInt(
                this.configService.get<string>("RATE_LIMIT_MAX") || "100",
                10
            ),
        };
    }

    /**
     * 获取缓存配置
     */
    getCacheConfig(): CacheConfig {
        return {
            enabled:
                this.configService.get<string>("CACHE_ENABLED") !== "false",
            ttl: parseInt(
                this.configService.get<string>("CACHE_TTL") || "300",
                10
            ),
        };
    }

    /**
     * 获取 API 基础路径
     */
    getApiBasePath(): string {
        const prefix = this.configService.get<string>("API_PREFIX") || "api";
        const version =
            this.configService.get<string>("API_VERSION") || "v1";
        return `/${prefix}/${version}`;
    }

    /**
     * 检查是否为开发环境
     */
    isDevelopment(): boolean {
        return this.configService.get<string>("NODE_ENV") === "development";
    }

    /**
     * 检查是否为生产环境
     */
    isProduction(): boolean {
        return this.configService.get<string>("NODE_ENV") === "production";
    }

    /**
     * 检查是否为测试环境
     */
    isTest(): boolean {
        return this.configService.get<string>("NODE_ENV") === "test";
    }

    /**
     * 获取 LLM API 密钥
     */
    getMinimaxApiKey(): string | undefined {
        return this.configService.get<string>("MINIMAX_API_KEY");
    }

    getOpenaiApiKey(): string | undefined {
        return this.configService.get<string>("OPENAI_API_KEY");
    }

    getGlmApiKey(): string | undefined {
        return this.configService.get<string>("GLM_API_KEY");
    }
}

export default AppConfigService;
