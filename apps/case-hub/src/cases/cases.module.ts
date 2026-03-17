/**
 * 病历模块
 */

import { Module } from "@nestjs/common";
import { CasesController } from "./cases.controller.js";
import { CasesService } from "./cases.service.js";
import { StorageModule } from "../storage/storage.module.js";

/**
 * 病历模块
 * 提供病历的 CRUD 操作、查询筛选、科室和疾病管理功能
 */
@Module({
    imports: [StorageModule],
    controllers: [CasesController],
    providers: [CasesService],
    exports: [CasesService],
})
export class CasesModule {}
