import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 用户数据接口，与 JwtStrategy.validate() 返回值对应
 */
export interface CurrentUserData {
  sub: string; // 用户ID
  email: string;
  name: string;
  isActive: boolean;
}

/**
 * GqlCurrentUser 装饰器
 *
 * 从 GraphQL 上下文中提取当前用户信息（由 JwtAuthGuard 注入）
 *
 * @param data 可选参数，指定返回用户对象的特定属性（如 'sub', 'email' 等）
 *
 * 使用示例：
 *
 * // 获取完整的用户对象
 * @GqlCurrentUser() user: CurrentUserData
 *
 * // 只获取用户ID
 * @GqlCurrentUser('sub') userId: string
 *
 * // 只获取邮箱
 * @GqlCurrentUser('email') email: string
 */
export const GqlCurrentUser = createParamDecorator(
  (
    data: keyof CurrentUserData | undefined,
    ctx: ExecutionContext,
  ): CurrentUserData | string | boolean | undefined => {
    // GraphQL 上下文
    const context = ctx.switchToHttp().getRequest();

    // 尝试从不同的位置获取用户信息
    const user = context.user || context.req?.user;

    // 如果没有用户信息，返回 undefined
    if (!user) {
      return undefined;
    }

    // 如果指定了属性名，返回该属性值
    if (data) {
      return user[data];
    }

    // 否则返回完整的用户对象
    return user;
  },
);
