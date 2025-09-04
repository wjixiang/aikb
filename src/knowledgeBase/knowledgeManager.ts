import Entity from "./Entity";
import { EntityData, KnowledgeData } from "./knowledge.type";
import createLoggerWithPrefix from "./logger";
import { AbstractEntityStorage } from "./storage/abstract-storage";

export default class knowledgeManager {
    logger = createLoggerWithPrefix("knowledgeManager")
    constructor(private entityStorage: AbstractEntityStorage) {

    }

    /**
     * Create a new entity and store it
     * @param data 
     */
    async createNewEntity(data: EntityData ): Promise<Entity>{
        try {
            await this.entityStorage.create_new_entity(data)   
            return new Entity(data, this.entityStorage) 
        } catch (error) {
            this.logger.error(JSON.stringify(error))
            throw error
        }
        
    }

    /**
     * 
     * @param data 
     * @alias shotEntity
     */
    async createKnowledge(data: KnowledgeData) {

    }
}