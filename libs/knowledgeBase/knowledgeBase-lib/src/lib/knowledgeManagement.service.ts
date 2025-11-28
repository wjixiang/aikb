import { Injectable } from "@nestjs/common";
import { EntityStorageService } from "./entity-storage.service";

@Injectable()
export class KnowledgeManagement {
    constructor(private entityStorage: EntityStorageService) {}

    async digestContext(context: string) {

    }

    async extractEntities(context: string) {
        
    }
}