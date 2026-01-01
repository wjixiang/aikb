/**
 * JWT Payload 类型定义
 * 统一管理所有 JWT 相关的接口和类型
 */

/**
 * JWT 访问令牌的 Payload
 * 用于用户身份验证和授权
 */
export interface JwtAccessTokenPayload {
    /** 用户ID (subject) */
    sub: string;
    /** 用户邮箱 */
    email: string;
    /** 签发时间 (issued at) - 由 JWT 库自动添加 */
    iat?: number;
    /** 过期时间 (expiration) - 由 JWT 库自动添加 */
    exp?: number;
}

/**
 * JWT 刷新令牌的 Payload
 * 用于获取新的访问令牌
 */
export interface JwtRefreshTokenPayload {
    /** 用户ID (subject) */
    sub: string;
    /** 用户邮箱 */
    email: string;
    /** 签发时间 (issued at) - 由 JWT 库自动添加 */
    iat?: number;
    /** 过期时间 (expiration) - 由 JWT 库自动添加 */
    exp?: number;
}

/**
 * JWT 验证后返回的用户信息
 * 由 JwtStrategy.validate() 方法返回
 */
export interface JwtValidatedUser {
    /** 用户ID */
    sub: string;
    /** 用户邮箱 */
    email: string;
    /** 用户名称 */
    name: string | null;
    /** 用户是否活跃 */
    isActive: boolean;
}

/**
 * JWT 令牌对
 * 包含访问令牌和刷新令牌
 */
export interface JwtTokenPair {
    /** 访问令牌 */
    accessToken: string;
    /** 刷新令牌 */
    refreshToken: string;
}

/**
 * JWT 令牌配置选项
 */
export interface JwtSignOptions {
    /** 令牌过期时间 (例如: '15m', '1h', '7d') */
    expiresIn?: string;
    /** 令牌主题 */
    subject?: string;
    /** 令牌签发者 */
    issuer?: string;
    /** 令牌受众 */
    audience?: string | string[];
}

/**
 * 测试用的 JWT Payload
 * 用于测试环境生成测试令牌
 */
export interface TestJwtPayload {
    /** 用户ID (subject) */
    sub: string;
    /** 用户邮箱 */
    email: string;
    /** 用户名称 (可选) */
    name?: string;
}
