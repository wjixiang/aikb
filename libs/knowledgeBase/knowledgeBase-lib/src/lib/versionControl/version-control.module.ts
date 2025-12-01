import { Module } from '@nestjs/common';
import { GitVersionControlService } from './version-control.service';
import { VersionControlMemoryService } from './version-control.memory.service';

@Module({
  providers: [GitVersionControlService, VersionControlMemoryService],
})
export class VersionControlModule {}
