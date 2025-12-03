import { Controller, Get } from '@nestjs/common';
import { EventBusService, GitVersionControlService, EVENT_TYPES } from 'knowledgeBase-lib';

@Controller('health')
export class HealthController {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly versionControl: GitVersionControlService,
  ) {}

  @Get()
  async check() {
    try {
      // 检查事件处理器状态
      const eventStats = this.eventBus.getSubscriptionStats();
      const hasEntityHandlers = eventStats[EVENT_TYPES.ENTITY_CREATED] > 0;
      
      // 检查版本控制状态
      let versionControlStatus = 'unknown';
      let repositoryCount = 0;
      
      try {
        const branches = await this.versionControl.getBranches('knowledge-base');
        repositoryCount = branches.length;
        versionControlStatus = repositoryCount > 0 ? 'initialized' : 'not_initialized';
      } catch (error) {
        versionControlStatus = 'error';
      }

      // 获取事件总线指标
      const metrics = this.eventBus.getMetrics();

      return {
        status: this.calculateOverallStatus(hasEntityHandlers, versionControlStatus),
        timestamp: new Date().toISOString(),
        services: {
          eventBus: {
            status: 'active',
            handlersRegistered: Object.keys(eventStats).length,
            entityHandlers: eventStats[EVENT_TYPES.ENTITY_CREATED] || 0,
            totalEventsPublished: metrics.totalEventsPublished,
            totalEventsProcessed: metrics.totalEventsProcessed,
            totalErrors: metrics.totalErrors,
            averageProcessingTime: metrics.averageProcessingTime,
          },
          versionControl: {
            status: versionControlStatus,
            repositories: repositoryCount,
            defaultRepository: 'knowledge-base',
          },
        },
        details: {
          eventHandlers: eventStats,
          eventTypeStats: metrics.eventTypeStats,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('events')
  async getEventStats() {
    const stats = this.eventBus.getSubscriptionStats();
    const metrics = this.eventBus.getMetrics();
    
    return {
      subscriptionStats: stats,
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('version-control')
  async getVersionControlStatus() {
    try {
      const branches = await this.versionControl.getBranches('knowledge-base');
      const status = await this.versionControl.getStatus('knowledge-base');
      
      return {
        repository: 'knowledge-base',
        branches: branches.map(branch => ({
          name: branch.name,
          isActive: branch.isActive,
          headCommitId: branch.headCommitId,
          createdAt: branch.createdAt,
          updatedAt: branch.updatedAt,
        })),
        workingTreeStatus: status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        repository: 'knowledge-base',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private calculateOverallStatus(hasEventHandlers: boolean, versionControlStatus: string): string {
    if (hasEventHandlers && versionControlStatus === 'initialized') {
      return 'healthy';
    } else if (hasEventHandlers && versionControlStatus === 'not_initialized') {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }
}