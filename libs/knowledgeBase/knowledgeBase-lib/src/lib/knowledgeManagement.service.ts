import { Injectable } from "@nestjs/common";
import { EntityStorageService } from "./knowledgeBaseStorage/entity-storage.service";

@Injectable()
export class KnowledgeManagement {
    constructor(private entityStorage: EntityStorageService) {}

    async createEntity() {

    }

    async updateEntity() {

    }

    async deleteEntity() {

    }

    async createPerspective() {

    }

    async updatePerspective() {

    }

    async deletePerspective() {

    }
}