import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { createEnhancedLogger } from "@/lib/console/enhanced-logger";

// 创建错误日志记录器
const errorLogger = createEnhancedLogger("ERROR-API", {
  level: "warn",
  enableConsole: process.env.NODE_ENV !== "production",
  enableFile: true,
  enableRemote: process.env.NODE_ENV === "production"
});

// 前端错误接口
interface FrontendError {
  type: string;
  severity: string;
  message: string;
  stack?: string;
  context: {
    userId?: string;
    sessionId?: string;
    page?: string;
    component?: string;
    action?: string;
    userAgent?: string;
    url?: string;
    timestamp?: number;
    [key: string]: any;
  };
  timestamp: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // 获取用户会话（可选）
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // 解析请求体
    const body: FrontendError = await request.json();

    // 验证必要字段
    if (!body.message || !body.type || !body.severity) {
      return NextResponse.json(
        { error: "Missing required fields: message, type, severity" },
        { status: 400 }
      );
    }

    // 记录错误日志
    errorLogger.error(
      `Frontend Error: ${body.message}`,
      {
        type: body.type,
        severity: body.severity,
        userId: userId || body.context.userId,
        sessionId: body.context.sessionId,
        page: body.context.page,
        component: body.context.component,
        action: body.context.action,
        userAgent: body.context.userAgent,
        url: body.context.url,
        timestamp: body.timestamp,
        stack: body.stack,
        additionalContext: { ...body.context }
      },
      new Error(body.message)
    );

    // 如果是严重错误，可以触发额外的处理
    if (body.severity === "critical" || body.severity === "high") {
      // 这里可以添加告警逻辑，如发送邮件、Slack通知等
      errorLogger.warn(
        `Critical frontend error detected: ${body.message}`,
        {
          type: body.type,
          severity: body.severity,
          userId: userId || body.context.userId,
          page: body.context.page,
          component: body.context.component
        }
      );
    }

    // 返回成功响应
    return NextResponse.json(
      { 
        success: true, 
        message: "Error logged successfully",
        errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      { status: 200 }
    );

  } catch (error) {
    // 记录处理错误时的异常
    errorLogger.error(
      "Failed to process frontend error log",
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
        method: request.method
      },
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    // 记录API性能
    const responseTime = Date.now() - startTime;
    errorLogger.logPerformance("POST /api/errors/log", responseTime, {
      success: true
    });
  }
}

// 获取错误统计信息（管理员功能）
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 这里可以添加管理员权限检查逻辑
    // const isAdmin = await checkAdminPermission(session.user.id);
    // if (!isAdmin) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const severity = searchParams.get("severity");
    const type = searchParams.get("type");

    // 这里可以从日志文件或数据库中查询错误统计
    // 由于我们使用文件日志，这里返回模拟数据
    const stats = {
      totalErrors: 0,
      errorsByType: {} as Record<string, number>,
      errorsBySeverity: {} as Record<string, number>,
      errorsByPage: {} as Record<string, number>,
      recentErrors: [] as any[]
    };

    return NextResponse.json(stats, { status: 200 });

  } catch (error) {
    errorLogger.error(
      "Failed to fetch error statistics",
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
        method: request.method
      },
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    const responseTime = Date.now() - startTime;
    errorLogger.logPerformance("GET /api/errors/log", responseTime, {
      success: true
    });
  }
}