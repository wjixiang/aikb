import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

type Role = 'admin' | 'editor' | 'user';

export function withRoles(roles: Role[]) {
  return async function middleware(req: NextRequest) {
    const token = await getToken({ req });

    if (!token) {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }

    const userRole = token.role as Role;
    if (!roles.includes(userRole)) {
      return NextResponse.redirect(new URL('/auth/unauthorized', req.url));
    }

    return NextResponse.next();
  };
}

export function withAdmin() {
  return withRoles(['admin']);
}

export function withEditor() {
  return withRoles(['editor', 'admin']);
}

export function withUser() {
  return withRoles(['user', 'editor', 'admin']);
}

// 验证用户是否为管理员的工具函数
export function isAdminUser(session: any): boolean {
  return session?.user?.role === 'admin';
}

// 验证用户是否为编辑者或管理员
export function isEditorUser(session: any): boolean {
  const role = session?.user?.role;
  return role === 'editor' || role === 'admin';
}

// 验证用户是否具有指定角色
export function hasRole(session: any, requiredRole: string): boolean {
  const userRole = session?.user?.role;

  // 角色权限层级
  const roleHierarchy: Record<string, string[]> = {
    user: ['user'],
    editor: ['user', 'editor'],
    admin: ['user', 'editor', 'admin'],
  };

  return roleHierarchy[userRole]?.includes(requiredRole) || false;
}

// 验证用户是否具有指定权限
export function hasPermission(session: any, permission: string): boolean {
  const userRole = session?.user?.role;

  // 角色权限映射
  const rolePermissions: Record<string, string[]> = {
    user: ['read:own', 'write:own'],
    editor: ['read:own', 'write:own', 'read:all', 'manage:content'],
    admin: [
      'read:own',
      'write:own',
      'read:all',
      'manage:content',
      'manage:users',
      'manage:system',
    ],
  };

  return rolePermissions[userRole]?.includes(permission) || false;
}

// 通用权限验证响应函数
export function requireAuth(session: any): NextResponse | null {
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

// 管理员权限验证的响应函数
export function requireAdmin(session: any): NextResponse | null {
  const authError = requireAuth(session);
  if (authError) return authError;

  if (!isAdminUser(session)) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 },
    );
  }

  return null;
}

// 编辑者权限验证的响应函数
export function requireEditor(session: any): NextResponse | null {
  const authError = requireAuth(session);
  if (authError) return authError;

  if (!isEditorUser(session)) {
    return NextResponse.json(
      { error: 'Editor access required' },
      { status: 403 },
    );
  }

  return null;
}

// 角色权限验证的响应函数
export function requireRole(
  session: any,
  requiredRole: string,
): NextResponse | null {
  const authError = requireAuth(session);
  if (authError) return authError;

  if (!hasRole(session, requiredRole)) {
    return NextResponse.json(
      { error: `Role '${requiredRole}' required` },
      { status: 403 },
    );
  }

  return null;
}

// 权限验证的响应函数
export function requirePermission(
  session: any,
  permission: string,
): NextResponse | null {
  const authError = requireAuth(session);
  if (authError) return authError;

  if (!hasPermission(session, permission)) {
    return NextResponse.json(
      { error: `Permission '${permission}' required` },
      { status: 403 },
    );
  }

  return null;
}
