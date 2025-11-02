import fs from "fs";
import path from "path";
import { createEnhancedLogger } from "@/lib/console/enhanced-logger";

// 日志分析器类
export class LogAnalyzer {
  private logger = createEnhancedLogger("LOG-ANALYZER");
  private logDir: string;

  constructor(logDir: string = process.env.LOG_DIR || "./logs") {
    this.logDir = logDir;
  }

  // 获取日志文件列表
  public getLogFiles(): string[] {
    try {
      if (!fs.existsSync(this.logDir)) {
        this.logger.warn(`Log directory does not exist: ${this.logDir}`);
        return [];
      }

      const files = fs.readdirSync(this.logDir);
      return files.filter(file => file.endsWith('.log')).sort();
    } catch (error) {
      this.logger.error("Failed to get log files", { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  // 解析日志文件
  public parseLogFile(filePath: string): LogEntry[] {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const entries: LogEntry[] = [];
      for (const line of lines) {
        try {
          const entry = this.parseLogLine(line);
          if (entry) {
            entries.push(entry);
          }
        } catch (parseError) {
          // 跳过无法解析的行
          this.logger.debug(`Failed to parse log line: ${line}`, { error: parseError });
        }
      }
      
      return entries;
    } catch (error) {
      this.logger.error(`Failed to parse log file: ${filePath}`, { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  // 解析单行日志
  private parseLogLine(line: string): LogEntry | null {
    try {
      // 尝试解析JSON格式的日志
      if (line.startsWith('{') && line.endsWith('}')) {
        const jsonEntry = JSON.parse(line);
        return {
          timestamp: new Date(jsonEntry.timestamp || jsonEntry.time),
          level: jsonEntry.level,
          message: jsonEntry.message,
          service: jsonEntry.service,
          meta: jsonEntry,
          raw: line
        };
      }

      // 尝试解析Winston格式的日志
      const winstonMatch = line.match(/^\{"level":"(\w+)","message":"([^"]+)","timestamp":"([^"]+)","service":"([^"]+)"(.*)\}$/);
      if (winstonMatch) {
        return {
          timestamp: new Date(winstonMatch[3]),
          level: winstonMatch[1],
          message: winstonMatch[2],
          service: winstonMatch[4],
          meta: JSON.parse(line),
          raw: line
        };
      }

      // 尝试解析自定义格式的日志
      const customMatch = line.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+)$/);
      if (customMatch) {
        return {
          timestamp: new Date(customMatch[1]),
          level: 'info',
          message: customMatch[3],
          service: customMatch[2],
          meta: { raw: line },
          raw: line
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // 按时间范围过滤日志
  public filterByTimeRange(entries: LogEntry[], startDate: Date, endDate: Date): LogEntry[] {
    return entries.filter(entry => 
      entry.timestamp >= startDate && entry.timestamp <= endDate
    );
  }

  // 按级别过滤日志
  public filterByLevel(entries: LogEntry[], levels: string[]): LogEntry[] {
    return entries.filter(entry => levels.includes(entry.level));
  }

  // 按服务过滤日志
  public filterByService(entries: LogEntry[], services: string[]): LogEntry[] {
    return entries.filter(entry => services.includes(entry.service));
  }

  // 按关键词搜索日志
  public searchByKeyword(entries: LogEntry[], keyword: string, caseSensitive: boolean = false): LogEntry[] {
    const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
    return entries.filter(entry => {
      const searchText = caseSensitive ? entry.message : entry.message.toLowerCase();
      return searchText.includes(searchKeyword);
    });
  }

  // 获取错误统计
  public getErrorStats(entries: LogEntry[]): ErrorStats {
    const errorEntries = entries.filter(entry => entry.level === 'error');
    const errorsByService: Record<string, number> = {};
    const errorsByMessage: Record<string, number> = {};
    const errorsByHour: Record<string, number> = {};

    errorEntries.forEach(entry => {
      // 按服务统计
      errorsByService[entry.service] = (errorsByService[entry.service] || 0) + 1;

      // 按消息统计（取前100个字符作为键）
      const messageKey = entry.message.substring(0, 100);
      errorsByMessage[messageKey] = (errorsByMessage[messageKey] || 0) + 1;

      // 按小时统计
      const hourKey = entry.timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      errorsByHour[hourKey] = (errorsByHour[hourKey] || 0) + 1;
    });

    return {
      totalErrors: errorEntries.length,
      errorsByService,
      errorsByMessage: Object.entries(errorsByMessage)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
      errorsByHour
    };
  }

  // 获取性能统计
  public getPerformanceStats(entries: LogEntry[]): PerformanceStats {
    const performanceEntries = entries.filter(entry => 
      entry.message.includes('Performance:') || 
      entry.meta.operation || 
      entry.meta.duration
    );

    const operations: Record<string, { count: number; totalDuration: number; minDuration: number; maxDuration: number }> = {};

    performanceEntries.forEach(entry => {
      const operation = entry.meta.operation || 'unknown';
      const duration = entry.meta.duration || 0;

      if (!operations[operation]) {
        operations[operation] = {
          count: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0
        };
      }

      operations[operation].count++;
      operations[operation].totalDuration += duration;
      operations[operation].minDuration = Math.min(operations[operation].minDuration, duration);
      operations[operation].maxDuration = Math.max(operations[operation].maxDuration, duration);
    });

    // 计算平均持续时间
    const operationStats: Record<string, OperationStats> = {};
    Object.entries(operations).forEach(([operation, stats]) => {
      operationStats[operation] = {
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count,
        minDuration: stats.minDuration,
        maxDuration: stats.maxDuration
      };
    });

    return {
      totalOperations: performanceEntries.length,
      operations: operationStats
    };
  }

  // 获取访问统计
  public getAccessStats(entries: LogEntry[]): AccessStats {
    const accessEntries = entries.filter(entry => 
      entry.level === 'http' || 
      entry.meta.method || 
      entry.meta.url
    );

    const requestsByMethod: Record<string, number> = {};
    const requestsByPath: Record<string, number> = {};
    const requestsByStatus: Record<string, number> = {};
    const responseTimes: number[] = [];

    accessEntries.forEach(entry => {
      const method = entry.meta.method || 'unknown';
      const url = entry.meta.url || 'unknown';
      const statusCode = entry.meta.statusCode || 'unknown';
      const responseTime = entry.meta.responseTime || 0;

      requestsByMethod[method] = (requestsByMethod[method] || 0) + 1;
      
      // 提取路径部分
      const path = url.split('?')[0];
      requestsByPath[path] = (requestsByPath[path] || 0) + 1;
      
      requestsByStatus[statusCode] = (requestsByStatus[statusCode] || 0) + 1;
      
      if (responseTime > 0) {
        responseTimes.push(responseTime);
      }
    });

    // 计算响应时间统计
    const sortedResponseTimes = responseTimes.sort((a, b) => a - b);
    const responseTimeStats = {
      count: responseTimes.length,
      avg: responseTimes.length > 0 ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0,
      min: responseTimes.length > 0 ? sortedResponseTimes[0] : 0,
      max: responseTimes.length > 0 ? sortedResponseTimes[sortedResponseTimes.length - 1] : 0,
      p50: responseTimes.length > 0 ? sortedResponseTimes[Math.floor(responseTimes.length * 0.5)] : 0,
      p95: responseTimes.length > 0 ? sortedResponseTimes[Math.floor(responseTimes.length * 0.95)] : 0,
      p99: responseTimes.length > 0 ? sortedResponseTimes[Math.floor(responseTimes.length * 0.99)] : 0
    };

    return {
      totalRequests: accessEntries.length,
      requestsByMethod,
      requestsByPath: Object.entries(requestsByPath)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
      requestsByStatus,
      responseTime: responseTimeStats
    };
  }

  // 生成日志报告
  public generateReport(options: {
    startDate?: Date;
    endDate?: Date;
    services?: string[];
    levels?: string[];
    keyword?: string;
  }): LogReport {
    const { startDate, endDate, services, levels, keyword } = options;
    
    // 获取所有日志文件
    const logFiles = this.getLogFiles();
    let allEntries: LogEntry[] = [];

    // 解析所有日志文件
    logFiles.forEach(file => {
      const filePath = path.join(this.logDir, file);
      const entries = this.parseLogFile(filePath);
      allEntries = allEntries.concat(entries);
    });

    // 按时间排序
    allEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // 应用过滤器
    if (startDate) {
      allEntries = this.filterByTimeRange(allEntries, startDate, endDate || new Date());
    }

    if (services && services.length > 0) {
      allEntries = this.filterByService(allEntries, services);
    }

    if (levels && levels.length > 0) {
      allEntries = this.filterByLevel(allEntries, levels);
    }

    if (keyword) {
      allEntries = this.searchByKeyword(allEntries, keyword);
    }

    // 生成统计信息
    const errorStats = this.getErrorStats(allEntries);
    const performanceStats = this.getPerformanceStats(allEntries);
    const accessStats = this.getAccessStats(allEntries);

    return {
      summary: {
        totalEntries: allEntries.length,
        dateRange: {
          start: allEntries.length > 0 ? allEntries[0].timestamp : new Date(),
          end: allEntries.length > 0 ? allEntries[allEntries.length - 1].timestamp : new Date()
        },
        services: [...new Set(allEntries.map(entry => entry.service))],
        levels: [...new Set(allEntries.map(entry => entry.level))]
      },
      errorStats,
      performanceStats,
      accessStats,
      entries: allEntries.slice(-100) // 最近100条日志
    };
  }
}

// 类型定义
export interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  service: string;
  meta: any;
  raw: string;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByService: Record<string, number>;
  errorsByMessage: Record<string, number>;
  errorsByHour: Record<string, number>;
}

export interface OperationStats {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
}

export interface PerformanceStats {
  totalOperations: number;
  operations: Record<string, OperationStats>;
}

export interface AccessStats {
  totalRequests: number;
  requestsByMethod: Record<string, number>;
  requestsByPath: Record<string, number>;
  requestsByStatus: Record<string, number>;
  responseTime: {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
}

export interface LogReport {
  summary: {
    totalEntries: number;
    dateRange: {
      start: Date;
      end: Date;
    };
    services: string[];
    levels: string[];
  };
  errorStats: ErrorStats;
  performanceStats: PerformanceStats;
  accessStats: AccessStats;
  entries: LogEntry[];
}

// 导出单例实例
export const logAnalyzer = new LogAnalyzer();