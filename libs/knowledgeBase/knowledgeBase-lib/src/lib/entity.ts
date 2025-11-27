import {EmbeddingConfig} from 'embedding'

interface Tag {
    id: string;
    name: string;
    description: string;
}

interface EntityNomanclature {
    name: string;
    acronym: string | null;
    language: 'en' | 'zh'
}

interface EntityData {
    id: string;
    nomanclature: EntityNomanclature[];
    abstract: {
        description: string;
        embedding: {
            config: EmbeddingConfig;
            vector: number[];
        }
    };
    code: {
        icd10: string | null;
        icd11: string | null;
        mesh: string | null;
    }
}

interface IEntityStorage {
    updateMainName: (newMainName: string) => Promise<string>;
    appendAliases: (aliases: string[]) => Promise<string[]>;
    removeAliases: (aliases: string[]) => Promise<string[]>;
    getEntityData: (id: string) => Promise<EntityData>;
}

class Entity {
    constructor(public data: EntityData, private storage: IEntityStorage) {}

}