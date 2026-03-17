/**
 * Generator Module - 病历生成模块
 * 提供病历生成的 NestJS 模块
 */

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GeneratorController } from "./generator.controller.js";
import { GeneratorService } from "./generator.service.js";

@Module({
    imports: [ConfigModule],
    controllers: [GeneratorController],
    providers: [GeneratorService],
    exports: [GeneratorService]
})
export class GeneratorModule {}
