/**
 * 存储模块
 * 提供病历存储、文件管理和查询统计功能
 */
import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { StorageService } from "./storage.service.js";
import { CaseRepositoryService } from "./case-repository.service.js";
import { PrismaService } from "./prisma.service.js";

/**
 * 存储模块
 * 导出 StorageService、CaseRepositoryService 和 PrismaService 供其他模块使用
 */
@Global()
@Module({
    imports: [ConfigModule],
    providers: [StorageService, CaseRepositoryService, PrismaService],
    exports: [StorageService, CaseRepositoryService, PrismaService],
})
export class StorageModule {}

export default StorageModule;
