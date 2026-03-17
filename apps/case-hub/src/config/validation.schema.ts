/**
 * 环境变量验证 Schema
 * 使用 Zod 验证和类型化环境变量
 */
import { z } from "zod";

/**
 * 环境变量验证 Schema
 */
export const validationSchema = z.object({
    // 应用配置
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
    PORT: z.string().default("3000"),
    HOST: z.string().default("0.0.0.0"),

    // 数据库配置
    DATABASE_URL: z.string().min(1, "数据库连接字符串不能为空"),
    DATABASE_POOL_SIZE: z.string().default("10"),
    DATABASE_TIMEOUT: z.string().default("30000"),

    // 日志配置
    LOG_LEVEL: z
        .enum(["debug", "info", "warn", "error"])
        .default("info"),
    LOG_FORMAT: z.enum(["json", "pretty"]).default("pretty"),

    // 文件存储配置
    STORAGE_TYPE: z.enum(["local", "s3", "minio"]).default("local"),
    STORAGE_PATH: z.string().default("./storage/cases"),
    STORAGE_MAX_SIZE: z.string().default("10485760"), // 10MB

    // S3/MinIO 配置 (当 STORAGE_TYPE 为 s3 或 minio 时使用)
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().default("case-hub"),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),

    // API 配置
    API_PREFIX: z.string().default("api"),
    API_VERSION: z.string().default("v1"),

    // 限流配置
    RATE_LIMIT_ENABLED: z.string().default("true"),
    RATE_LIMIT_WINDOW_MS: z.string().default("60000"),
    RATE_LIMIT_MAX: z.string().default("100"),

    // 缓存配置
    CACHE_ENABLED: z.string().default("true"),
    CACHE_TTL: z.string().default("300"),

    // LLM API 配置
    MINIMAX_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GLM_API_KEY: z.string().optional(),

    // 安全配置
    CORS_ORIGIN: z.string().default("*"),
    CORS_CREDENTIALS: z.string().default("true"),
});

/**
 * 环境变量类型
 */
export type EnvConfig = z.infer<typeof validationSchema>;

/**
 * 验证环境变量
 * @param env 原始环境变量对象
 * @returns 验证后的环境变量
 */
export function validateEnv(env: Record<string, string | undefined>): EnvConfig {
    const result = validationSchema.safeParse(env);

    if (!result.success) {
        const errors = result.error.errors.map(
            (err) => `${err.path.join(".")}: ${err.message}`
        );
        throw new Error(`环境变量验证失败:\n${errors.join("\n")}`);
    }

    return result.data;
}

/**
 * 获取默认配置
 * @returns 默认配置对象
 */
export function getDefaultConfig(): EnvConfig {
    return {
        NODE_ENV: "development",
        PORT: "3000",
        HOST: "0.0.0.0",
        DATABASE_URL: "postgresql://user:password@localhost:5432/case_hub",
        DATABASE_POOL_SIZE: "10",
        DATABASE_TIMEOUT: "30000",
        LOG_LEVEL: "info",
        LOG_FORMAT: "pretty",
        STORAGE_TYPE: "local",
        STORAGE_PATH: "./storage/cases",
        STORAGE_MAX_SIZE: "10485760",
        S3_REGION: "us-east-1",
        S3_BUCKET: "case-hub",
        API_PREFIX: "api",
        API_VERSION: "v1",
        RATE_LIMIT_ENABLED: "true",
        RATE_LIMIT_WINDOW_MS: "60000",
        RATE_LIMIT_MAX: "100",
        CACHE_ENABLED: "true",
        CACHE_TTL: "300",
        CORS_ORIGIN: "*",
        CORS_CREDENTIALS: "true",
    };
}

export default validationSchema;
