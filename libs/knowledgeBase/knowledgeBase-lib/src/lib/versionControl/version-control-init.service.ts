import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GitVersionControlService } from './version-control.service';

/**
 * 版本控制初始化服务
 * 负责在应用启动时初始化必要的版本控制仓库
 */
@Injectable()
export class VersionControlInitService implements OnModuleInit {
  private readonly logger = new Logger(VersionControlInitService.name);

  constructor(private readonly versionControl: GitVersionControlService) {}

  async onModuleInit() {
    await this.initializeDefaultRepositories();
  }

  /**
   * 初始化默认仓库
   */
  private async initializeDefaultRepositories(): Promise<void> {
    const defaultRepositories = ['knowledge-base'];

    for (const repositoryId of defaultRepositories) {
      try {
        await this.versionControl.initRepository(repositoryId);
        this.logger.log(
          `✅ Repository '${repositoryId}' initialized successfully`,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('already exists')
        ) {
          this.logger.log(`✅ Repository '${repositoryId}' already exists`);
        } else {
          this.logger.error(
            `❌ Failed to initialize repository '${repositoryId}':`,
            error,
          );
          throw error;
        }
      }
    }
  }

  /**
   * 手动初始化指定仓库
   */
  async initializeRepository(repositoryId: string): Promise<void> {
    try {
      await this.versionControl.initRepository(repositoryId);
      this.logger.log(
        `✅ Repository '${repositoryId}' initialized successfully`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        this.logger.log(`✅ Repository '${repositoryId}' already exists`);
      } else {
        this.logger.error(
          `❌ Failed to initialize repository '${repositoryId}':`,
          error,
        );
        throw error;
      }
    }
  }

  /**
   * 检查仓库是否已初始化
   */
  async isRepositoryInitialized(repositoryId: string): Promise<boolean> {
    try {
      const branches = await this.versionControl.getBranches(repositoryId);
      return branches.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取所有已初始化的仓库状态
   */
  async getRepositoryStatus(
    repositoryIds: string[],
  ): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};

    for (const repositoryId of repositoryIds) {
      status[repositoryId] = await this.isRepositoryInitialized(repositoryId);
    }

    return status;
  }
}
