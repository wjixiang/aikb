import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { NextRequestWithAuth } from "next-auth/middleware";

type Role = "admin" | "editor" | "user";

// API 中间件 - 检查角色权限
export function apiWithRoles(roles: Role[]) {
  return async function middleware(req: NextRequest) {
    const token = await getToken({ req });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = token.role as Role;
    if (!roles.includes(userRole)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.next();
  };
}

// API 中间件 - 检查权限
export function apiWithPermission(permission: string) {
  return async function middleware(req: NextRequest) {
    const token = await getToken({ req });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 权限检查 - 基于角色映射
    const userRole = token.role as Role;
    const rolePermissions: Record<string, string[]> = {
      'user': ['read:own', 'write:own'],
      'editor': ['read:own', 'write:own', 'read:all', 'manage:content'],
      'admin': ['read:own', 'write:own', 'read:all', 'manage:content', 'manage:users', 'manage:system']
    };

    if (!rolePermissions[userRole]?.includes(permission)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    return NextResponse.next();
  };
}

// Next.js 13+ 应用路由器中间件
export function authMiddleware(req: NextRequestWithAuth) {
  const token = req.nextauth.token;
  
  // 保护管理员路由
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }
    
    if (token.role !== 'admin') {
      return NextResponse.redirect(new URL('/auth/unauthorized', req.url));
    }
  }

  // 保护编辑者路由
  if (req.nextUrl.pathname.startsWith('/editor')) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }
    
    if (token.role !== 'editor' && token.role !== 'admin') {
      return NextResponse.redirect(new URL('/auth/unauthorized', req.url));
    }
  }

  return NextResponse.next();
}

// 路由保护装饰器（用于 API 路由）
export function protectRoute(requiredRole: Role | Role[] = 'user') {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const [request] = args;
      const token = await getToken({ req: request });
      
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      const userRole = token.role as Role;
      const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      
      if (!requiredRoles.includes(userRole)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

// 权限保护装饰器
export function protectWithPermission(permission: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const [request] = args;
      const token = await getToken({ req: request });
      
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      
      const userRole = token.role as Role;
      const rolePermissions: Record<string, string[]> = {
        'user': ['read:own', 'write:own'],
        'editor': ['read:own', 'write:own', 'read:all', 'manage:content'],
        'admin': ['read:own', 'write:own', 'read:all', 'manage:content', 'manage:users', 'manage:system']
      };
      
      if (!rolePermissions[userRole]?.includes(permission)) {
        return NextResponse.json({ error: "Permission denied" }, { status: 403 });
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

// 导出中间件快捷方式
export const apiWithAdmin = () => apiWithRoles(['admin']);
export const apiWithEditor = () => apiWithRoles(['editor', 'admin']);
export const apiWithUser = () => apiWithRoles(['user', 'editor', 'admin']);