import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  UserQueryDto,
  UpdateUserDto,
  UpdatePasswordDto,
  EmailVerificationDto,
  PhoneVerificationDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
  BulkOperationDto,
  UserSessionQueryDto,
  UserResponse,
  UserDetailResponse,
  PaginatedResponse,
  UserStatsResponse,
  SessionResponse,
  LoginLogResponse,
  VerificationResponse,
  PasswordResetResponse,
  BulkOperationResponse,
  UserActivityResponse,
  ApiResponse,
  LoginSchema,
  RegisterSchema,
  AuthResponseSchema,
  AuthResponse,
  LoginDto,
  RegisterDto,
} from 'auth-lib';
import {
  getMockDb,
  clearMockDb,
  generateId,
  generateToken,
  MockUser,
  MockRefreshToken,
  MockSession,
  MockLoginLog,
  MockPasswordHistory,
  MockEmailVerification,
  MockPasswordReset,
} from './test-db-setup';

@Injectable()
export class MockAuthService {
  private readonly mockDb = getMockDb();

  constructor(private readonly jwtService: JwtService) {}

  /**
   * 获取用户列表（分页）
   */
  async getUsers(
    query: UserQueryDto,
  ): Promise<PaginatedResponse<UserResponse>> {
    const {
      page,
      limit,
      search,
      isActive,
      isEmailVerified,
      isPhoneVerified,
      sortBy,
      sortOrder,
    } = query;

    const skip = (page - 1) * limit;

    // 构建查询条件
    let filteredUsers = Array.from(this.mockDb.users.values());

    if (search) {
      filteredUsers = filteredUsers.filter(
        (user) =>
          user.email.toLowerCase().includes(search.toLowerCase()) ||
          (user.name &&
            user.name.toLowerCase().includes(search.toLowerCase())) ||
          (user.phone && user.phone.includes(search)),
      );
    }

    if (isActive !== undefined) {
      filteredUsers = filteredUsers.filter(
        (user) => user.isActive === isActive,
      );
    }

    if (isEmailVerified !== undefined) {
      filteredUsers = filteredUsers.filter(
        (user) => user.isEmailVerified === isEmailVerified,
      );
    }

    if (isPhoneVerified !== undefined) {
      filteredUsers = filteredUsers.filter(
        (user) => user.isPhoneVerified === isPhoneVerified,
      );
    }

    // 排序
    filteredUsers.sort((a, b) => {
      const aValue = a[sortBy as keyof MockUser];
      const bValue = b[sortBy as keyof MockUser];

      if (aValue === undefined) return sortOrder === 'asc' ? -1 : 1;
      if (bValue === undefined) return sortOrder === 'asc' ? 1 : -1;

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice(skip, skip + limit);

    const userResponses: UserResponse[] = paginatedUsers.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    return {
      data: userResponses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 根据ID获取用户详情
   */
  async getUserById(id: string): Promise<UserDetailResponse> {
    const user = this.mockDb.users.get(id);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 获取关联数据
    const refreshTokens = Array.from(this.mockDb.refreshTokens.values()).filter(
      (token) => token.userId === id,
    );
    const sessions = Array.from(this.mockDb.sessions.values()).filter(
      (session) => session.userId === id,
    );
    const loginLogs = Array.from(this.mockDb.loginLogs.values()).filter(
      (log) => log.userId === id,
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      refreshTokens,
      sessions,
      loginLogs,
      wechatAccounts: [],
      accounts: [],
    };
  }

  /**
   * 更新用户信息
   */
  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponse> {
    const { name, avatar, phone, isActive } = updateUserDto;

    // 检查用户是否存在
    const existingUser = this.mockDb.users.get(id);

    if (!existingUser) {
      throw new NotFoundException('用户不存在');
    }

    // 如果更新手机号，检查是否已被使用
    if (phone && phone !== existingUser.phone) {
      const phoneExists = Array.from(this.mockDb.users.values()).find(
        (user) => user.phone === phone,
      );

      if (phoneExists) {
        throw new ConflictException('手机号已被使用');
      }
    }

    const updatedUser: MockUser = {
      ...existingUser,
      name,
      avatar,
      phone,
      isActive: isActive || false,
      updatedAt: new Date(),
    };

    this.mockDb.users.set(id, updatedUser);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatar: updatedUser.avatar,
      phone: updatedUser.phone,
      isEmailVerified: updatedUser.isEmailVerified,
      isPhoneVerified: updatedUser.isPhoneVerified,
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  /**
   * 更新用户密码
   */
  async updatePassword(
    id: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<ApiResponse> {
    const { currentPassword, newPassword } = updatePasswordDto;

    const user = this.mockDb.users.get(id);

    if (!user || !user.passwordHash || !user.passwordSalt) {
      throw new NotFoundException('用户不存在或密码未设置');
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('当前密码错误');
    }

    // 检查新密码是否与当前密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }

    // 生成新密码哈希
    const saltRounds = 10;
    const passwordSalt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // 保存密码历史
    const passwordHistory: MockPasswordHistory = {
      id: generateId(),
      userId: id,
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      iterations: user.passwordIterations || 100000,
      createdAt: new Date(),
    };
    this.mockDb.passwordHistory.set(passwordHistory.id, passwordHistory);

    // 更新密码
    const updatedUser: MockUser = {
      ...user,
      passwordHash,
      passwordSalt,
      passwordIterations: saltRounds,
      updatedAt: new Date(),
    };
    this.mockDb.users.set(id, updatedUser);

    // 撤销所有刷新令牌
    Array.from(this.mockDb.refreshTokens.values())
      .filter((token) => token.userId === id)
      .forEach((token) => {
        token.isRevoked = true;
        this.mockDb.refreshTokens.set(token.id, token);
      });

    return {
      success: true,
      message: '密码更新成功',
      timestamp: new Date(),
    };
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<ApiResponse> {
    const user = this.mockDb.users.get(id);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    this.mockDb.users.delete(id);

    return {
      success: true,
      message: '用户删除成功',
      timestamp: new Date(),
    };
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<UserStatsResponse> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    const users = Array.from(this.mockDb.users.values());
    const loginLogs = Array.from(this.mockDb.loginLogs.values());

    const totalUsers = users.length;
    const activeUsers = users.filter((user) => user.isActive).length;
    const verifiedEmailUsers = users.filter(
      (user) => user.isEmailVerified,
    ).length;
    const verifiedPhoneUsers = users.filter(
      (user) => user.isPhoneVerified,
    ).length;
    const newUsersThisMonth = users.filter(
      (user) => user.createdAt >= startOfMonth,
    ).length;
    const newUsersThisWeek = users.filter(
      (user) => user.createdAt >= startOfWeek,
    ).length;

    const totalLogins = loginLogs.length;
    const successfulLogins = loginLogs.filter((log) => log.success).length;
    const failedLogins = loginLogs.filter((log) => !log.success).length;
    const todayLogins = loginLogs.filter((log) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return log.createdAt >= today;
    }).length;

    return {
      totalUsers,
      activeUsers,
      verifiedEmailUsers,
      verifiedPhoneUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      loginStats: {
        totalLogins,
        successfulLogins,
        failedLogins,
        todayLogins,
      },
    };
  }

  /**
   * 获取用户会话
   */
  async getUserSessions(
    query: UserSessionQueryDto,
  ): Promise<SessionResponse[]> {
    const { userId, isActive } = query;

    let sessions = Array.from(this.mockDb.sessions.values()).filter(
      (session) => session.userId === userId,
    );

    if (isActive !== undefined) {
      sessions = sessions.filter((session) => session.isActive === isActive);
    }

    sessions.sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime(),
    );

    return sessions.slice(0, 50).map((session) => ({
      id: session.id,
      sessionToken: session.sessionToken,
      userId: session.userId,
      expires: session.expires,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      clientInfo: session.clientInfo,
      isActive: session.isActive,
    }));
  }

  /**
   * 撤销用户会话
   */
  async revokeSession(sessionId: string): Promise<ApiResponse> {
    const session = this.mockDb.sessions.get(sessionId);

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    const updatedSession: MockSession = {
      ...session,
      isActive: false,
    };
    this.mockDb.sessions.set(sessionId, updatedSession);

    return {
      success: true,
      message: '会话已撤销',
      timestamp: new Date(),
    };
  }

  /**
   * 撤销用户所有会话
   */
  async revokeAllUserSessions(userId: string): Promise<ApiResponse> {
    Array.from(this.mockDb.sessions.values())
      .filter((session) => session.userId === userId)
      .forEach((session) => {
        const updatedSession: MockSession = {
          ...session,
          isActive: false,
        };
        this.mockDb.sessions.set(session.id, updatedSession);
      });

    return {
      success: true,
      message: '所有会话已撤销',
      timestamp: new Date(),
    };
  }

  /**
   * 发送邮箱验证
   */
  async sendEmailVerification(
    emailVerificationDto: EmailVerificationDto,
  ): Promise<VerificationResponse> {
    const { email } = emailVerificationDto;

    const user = Array.from(this.mockDb.users.values()).find(
      (user) => user.email === email,
    );

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.isEmailVerified) {
      return {
        success: false,
        message: '邮箱已验证',
      };
    }

    // 生成验证令牌
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期

    // 保存验证令牌
    const emailVerification: MockEmailVerification = {
      id: generateId(),
      email,
      token,
      userId: user.id,
      expiresAt,
      createdAt: new Date(),
    };
    this.mockDb.emailVerifications.set(emailVerification.id, emailVerification);

    return {
      success: true,
      message: '验证邮件已发送',
      token,
      expiresAt,
    };
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(token: string): Promise<VerificationResponse> {
    const verification = Array.from(
      this.mockDb.emailVerifications.values(),
    ).find((v) => v.token === token);

    if (!verification) {
      return {
        success: false,
        message: '验证令牌无效',
      };
    }

    if (verification.expiresAt < new Date()) {
      return {
        success: false,
        message: '验证令牌已过期',
      };
    }

    // 更新用户邮箱验证状态
    const user = this.mockDb.users.get(verification.userId);
    if (user) {
      const updatedUser: MockUser = {
        ...user,
        isEmailVerified: true,
      };
      this.mockDb.users.set(verification.userId, updatedUser);
    }

    // 删除验证令牌
    this.mockDb.emailVerifications.delete(verification.id);

    return {
      success: true,
      message: '邮箱验证成功',
    };
  }

  /**
   * 请求密码重置
   */
  async requestPasswordReset(
    passwordResetRequestDto: PasswordResetRequestDto,
  ): Promise<PasswordResetResponse> {
    const { email } = passwordResetRequestDto;

    const user = Array.from(this.mockDb.users.values()).find(
      (user) => user.email === email,
    );

    if (!user) {
      // 为了安全，即使用户不存在也返回成功
      return {
        success: true,
        message: '如果邮箱存在，重置链接已发送',
      };
    }

    // 生成重置令牌
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期

    // 保存重置令牌
    const passwordReset: MockPasswordReset = {
      id: generateId(),
      email,
      token,
      userId: user.id,
      isUsed: false,
      expiresAt,
      createdAt: new Date(),
    };
    this.mockDb.passwordResets.set(passwordReset.id, passwordReset);

    return {
      success: true,
      message: '密码重置链接已发送',
      token,
      expiresAt,
    };
  }

  /**
   * 确认密码重置
   */
  async confirmPasswordReset(
    passwordResetConfirmDto: PasswordResetConfirmDto,
  ): Promise<PasswordResetResponse> {
    const { token, newPassword } = passwordResetConfirmDto;

    const reset = Array.from(this.mockDb.passwordResets.values()).find(
      (r) => r.token === token,
    );

    if (!reset) {
      return {
        success: false,
        message: '重置令牌无效',
      };
    }

    if (reset.expiresAt < new Date()) {
      return {
        success: false,
        message: '重置令牌已过期',
      };
    }

    if (reset.isUsed) {
      return {
        success: false,
        message: '重置令牌已被使用',
      };
    }

    // 生成新密码哈希
    const saltRounds = 10;
    const passwordSalt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // 保存密码历史
    const user = this.mockDb.users.get(reset.userId);
    if (user && user.passwordHash) {
      const passwordHistory: MockPasswordHistory = {
        id: generateId(),
        userId: reset.userId,
        passwordHash: user.passwordHash,
        passwordSalt: user.passwordSalt || '',
        iterations: user.passwordIterations || 100000,
        createdAt: new Date(),
      };
      this.mockDb.passwordHistory.set(passwordHistory.id, passwordHistory);
    }

    // 更新密码
    if (user) {
      const updatedUser: MockUser = {
        ...user,
        passwordHash,
        passwordSalt,
        passwordIterations: saltRounds,
        updatedAt: new Date(),
      };
      this.mockDb.users.set(reset.userId, updatedUser);
    }

    // 标记重置令牌为已使用
    const updatedReset: MockPasswordReset = {
      ...reset,
      isUsed: true,
    };
    this.mockDb.passwordResets.set(reset.id, updatedReset);

    // 撤销所有刷新令牌
    Array.from(this.mockDb.refreshTokens.values())
      .filter((token) => token.userId === reset.userId)
      .forEach((token) => {
        const updatedToken: MockRefreshToken = {
          ...token,
          isRevoked: true,
        };
        this.mockDb.refreshTokens.set(token.id, updatedToken);
      });

    return {
      success: true,
      message: '密码重置成功',
    };
  }

  /**
   * 批量操作用户
   */
  async bulkOperation(
    bulkOperationDto: BulkOperationDto,
  ): Promise<BulkOperationResponse> {
    const { userIds, action } = bulkOperationDto;

    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        switch (action) {
          case 'activate':
            const user = this.mockDb.users.get(userId);
            if (user) {
              const updatedUser: MockUser = {
                ...user,
                isActive: true,
              };
              this.mockDb.users.set(userId, updatedUser);
            }
            break;
          case 'deactivate':
            const deactivateUser = this.mockDb.users.get(userId);
            if (deactivateUser) {
              const updatedUser: MockUser = {
                ...deactivateUser,
                isActive: false,
              };
              this.mockDb.users.set(userId, updatedUser);

              // 撤销所有会话
              Array.from(this.mockDb.sessions.values())
                .filter((session) => session.userId === userId)
                .forEach((session) => {
                  const updatedSession: MockSession = {
                    ...session,
                    isActive: false,
                  };
                  this.mockDb.sessions.set(session.id, updatedSession);
                });
            }
            break;
          case 'delete':
            this.mockDb.users.delete(userId);
            break;
        }
        processedCount++;
      } catch (error) {
        failedCount++;
        errors.push(
          `用户 ${userId}: ${error instanceof Error ? error.message : '未知错误'}`,
        );
      }
    }

    return {
      success: failedCount === 0,
      message: `批量操作完成，成功: ${processedCount}，失败: ${failedCount}`,
      processedCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 获取用户活动日志
   */
  async getUserActivity(userId: string): Promise<UserActivityResponse> {
    const loginLogs = Array.from(this.mockDb.loginLogs.values())
      .filter((log) => log.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50);

    const activities = loginLogs.map((log) => ({
      type: 'LOGIN',
      description: log.success
        ? `成功登录 (${log.loginType})`
        : `登录失败: ${log.failureReason || '未知原因'}`,
      timestamp: log.createdAt,
      ip: log.ip,
      userAgent: log.userAgent,
    }));

    return {
      userId,
      activities,
    };
  }

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name } = registerDto;

    // 检查用户是否已存在
    const existingUser = Array.from(this.mockDb.users.values()).find(
      (user) => user.email === email,
    );

    if (existingUser) {
      throw new ConflictException('用户已存在');
    }

    // 密码哈希处理
    const saltRounds = 10;
    const passwordSalt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const user: MockUser = {
      id: generateId(),
      email,
      name,
      passwordHash,
      passwordSalt,
      passwordIterations: saltRounds,
      isActive: true,
      isEmailVerified: false,
      isPhoneVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.mockDb.users.set(user.id, user);

    // 生成令牌
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
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
    const user = Array.from(this.mockDb.users.values()).find(
      (user) => user.email === email,
    );

    if (!user || !user.passwordHash || !user.passwordSalt) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // 记录登录失败
      const loginLog: MockLoginLog = {
        id: generateId(),
        userId: user.id,
        success: false,
        loginType: 'password',
        failureReason: '密码错误',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
      };
      this.mockDb.loginLogs.set(loginLog.id, loginLog);

      throw new UnauthorizedException('用户名或密码错误');
    }

    // 记录登录成功
    const loginLog: MockLoginLog = {
      id: generateId(),
      userId: user.id,
      success: true,
      loginType: 'password',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      createdAt: new Date(),
    };
    this.mockDb.loginLogs.set(loginLog.id, loginLog);

    // 更新最后登录时间
    const updatedUser: MockUser = {
      ...user,
      lastLoginAt: new Date(),
    };
    this.mockDb.users.set(user.id, updatedUser);

    // 生成令牌
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      ...tokens,
    };
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const token = Array.from(this.mockDb.refreshTokens.values()).find(
      (t) => t.token === refreshToken && !t.isRevoked && t.expires > new Date(),
    );

    if (!token) {
      throw new UnauthorizedException('无效的刷新令牌');
    }

    const user = this.mockDb.users.get(token.userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 撤销旧的刷新令牌
    const revokedToken: MockRefreshToken = {
      ...token,
      isRevoked: true,
    };
    this.mockDb.refreshTokens.set(token.id, revokedToken);

    // 生成新令牌
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      ...tokens,
    };
  }

  /**
   * 验证令牌
   */
  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      const user = this.mockDb.users.get(payload.sub);

      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('无效的令牌');
    }
  }

  /**
   * 登出
   */
  async logout(refreshToken: string): Promise<ApiResponse> {
    const token = Array.from(this.mockDb.refreshTokens.values()).find(
      (t) => t.token === refreshToken,
    );

    if (token) {
      const revokedToken: MockRefreshToken = {
        ...token,
        isRevoked: true,
      };
      this.mockDb.refreshTokens.set(token.id, revokedToken);
    }

    return {
      success: true,
      message: '登出成功',
      timestamp: new Date(),
    };
  }

  /**
   * 生成令牌
   */
  private async generateTokens(
    user: MockUser,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload);
    const refreshTokenValue = generateToken();

    // 保存刷新令牌
    const refreshToken: MockRefreshToken = {
      id: generateId(),
      token: refreshTokenValue,
      userId: user.id,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
      isRevoked: false,
      createdAt: new Date(),
    };
    this.mockDb.refreshTokens.set(refreshToken.id, refreshToken);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }
}
