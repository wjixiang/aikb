// libs/auth/auth-lib/src/lib/services/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {prisma} from 'auth-db'
import * as bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto, AuthResponse, JwtPayload } from '../interfaces/auth.interface';

@Injectable()
export class AuthService {
  private readonly prisma = prisma
  constructor(
    private readonly jwtService: JwtService
  ) {}

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name } = registerDto;

    // 检查用户是否已存在
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('用户已存在');
    }

    // 密码哈希处理
    const saltRounds = 10;
    const passwordSalt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        passwordSalt,
        passwordIterations: saltRounds,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // 生成令牌
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
      },
      ...tokens,
    };
  }

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash || !user.passwordSalt) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 更新最后登录时间
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
    };

    // 生成令牌
    const tokens = await this.generateTokens({
      id: userResponse.id,
      email: userResponse.email,
      name: userResponse.name || null,
    });

    return {
      user: userResponse,
      ...tokens,
    };
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // 验证刷新令牌
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env['JWT_REFRESH_SECRET'],
      });

      // 查找用户
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      // 生成新令牌
      const tokens = await this.generateTokens({
        id: user.id,
        email: user.email,
        name: user.name || null,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
        },
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('无效的刷新令牌');
    }
  }

  /**
   * 验证用户
   */
  async validateUser(payload: JwtPayload): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }

    return user;
  }

  /**
   * 生成JWT令牌
   */
  private async generateTokens(user: { id: string; email: string; name: string| null }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    // 生成访问令牌
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env['JWT_SECRET'],
      expiresIn: process.env['JWT_EXPIRATION'] || '15m',
    } as any);

    // 生成刷新令牌
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env['JWT_REFRESH_SECRET'],
      expiresIn: process.env['JWT_REFRESH_EXPIRATION'] || '7d',
    } as any);

    // 保存刷新令牌到数据库
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * 登出
   */
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });
  }
}
