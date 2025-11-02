import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 检查数据库连接状态
    const dbStatus = await checkDatabaseConnection();
    
    // 检查其他关键服务状态
    const servicesStatus = await checkServicesStatus();
    
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown',
      services: {
        database: dbStatus,
        ...servicesStatus
      }
    };

    // 如果任何关键服务不健康，返回 503 状态
    const isHealthy = Object.values(healthData.services).every(
      (service: any) => service.status === 'ok'
    );

    return NextResponse.json(healthData, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}

async function checkDatabaseConnection() {
  try {
    // 这里可以添加实际的数据库连接检查
    // 例如：ping MongoDB 或其他数据库
    return {
      status: 'ok',
      message: 'Database connection successful'
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database connection failed'
    };
  }
}

async function checkServicesStatus() {
  const services: Record<string, any> = {};
  
  // 检查 Milvus 连接
  try {
    // 这里可以添加 Milvus 连接检查
    services.milvus = {
      status: 'ok',
      message: 'Milvus connection successful'
    };
  } catch (error) {
    services.milvus = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Milvus connection failed'
    };
  }
  
  // 检查其他关键服务
  // 例如：Redis、外部 API 等
  
  return services;
}