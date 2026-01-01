import { JwtService } from '@nestjs/jwt';
import type {
    TestJwtPayload,
    JwtAccessTokenPayload,
    JwtRefreshTokenPayload,
} from './jwt.types';

/**
 * 生成测试用的JWT访问令牌
 * @param payload JWT payload
 * @param expiresIn 过期时间，默认 '15m'
 * @returns JWT token string
 */
export function generateTestAccessToken(
    payload: TestJwtPayload,
    expiresIn: string = '15m'
): string {
    const secret = process.env['JWT_SECRET'];
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    const jwtService = new JwtService({ secret });
    return jwtService.sign(payload as JwtAccessTokenPayload, { expiresIn } as any);
}

/**
 * 生成测试用的JWT刷新令牌
 * @param payload JWT payload
 * @param expiresIn 过期时间，默认 '7d'
 * @returns JWT token string
 */
export function generateTestRefreshToken(
    payload: TestJwtPayload,
    expiresIn: string = '7d'
): string {
    const secret = process.env['JWT_REFRESH_SECRET'];
    if (!secret) {
        throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }
    const jwtService = new JwtService({ secret });
    return jwtService.sign(payload as JwtRefreshTokenPayload, { expiresIn } as any);
}

/**
 * 测试认证辅助类
 * 用于在测试中方便地生成JWT token和认证头
 */
export class TestAuthHelper {
    /**
     * 生成测试用的访问令牌
     * @param userId 用户ID
     * @param email 用户邮箱
     * @param expiresIn 过期时间，默认 '15m'
     * @returns JWT token string
     */
    static generateTestToken(
        userId: string,
        email: string,
        expiresIn?: string
    ): string {
        return generateTestAccessToken({ sub: userId, email }, expiresIn);
    }

    /**
     * 生成测试用的刷新令牌
     * @param userId 用户ID
     * @param email 用户邮箱
     * @param expiresIn 过期时间，默认 '7d'
     * @returns JWT token string
     */
    static generateTestRefreshToken(
        userId: string,
        email: string,
        expiresIn?: string
    ): string {
        return generateTestRefreshToken({ sub: userId, email }, expiresIn);
    }

    /**
     * 生成测试用的认证头
     * @param userId 用户ID
     * @param email 用户邮箱
     * @returns 包含 Authorization header 的对象
     */
    static generateTestHeaders(userId: string, email: string) {
        const token = this.generateTestToken(userId, email);
        return {
            Authorization: `Bearer ${token}`,
        };
    }
}
