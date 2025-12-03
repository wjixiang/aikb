import { Module } from '@nestjs/common';
import { GitVersionControlService } from './version-control.service';
import { VersionControlMemoryService } from './version-control.memory.service';
import { VersionControlInitService } from './version-control-init.service';
import { VersionControlDBPrismaService } from 'VersionControl-db';

@Module({
  providers: [
    VersionControlDBPrismaService,
    GitVersionControlService,
    VersionControlMemoryService,
    VersionControlInitService, // 添加初始化服务
  ],
  exports: [
    GitVersionControlService,
    VersionControlInitService, // 导出初始化服务供其他模块使用
  ],
})
export class VersionControlModule {}
