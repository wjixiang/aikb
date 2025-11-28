import { Injectable } from "@nestjs/common";
import { EntityStorage } from "./entityStorage.service";

@Injectable()
export class KnowledgeManagement {
    constructor(private entityStorage: EntityStorage) {}

    async digestContext(context: string) {

    }

    async extractEntities(context: string) {
        
    }
}