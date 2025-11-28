import { EmbeddingConfig } from "embedding";

export interface Tag {
    id: string;
    name: string;
    description: string;
}

export interface EntityNomanclature {
    name: string;
    acronym: string | null;
    language: 'en' | 'zh'
}

export interface EntityData {
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

export interface IEntityStorage {
    updateMainName: (newMainName: string) => Promise<string>;
    appendAliases: (aliases: string[]) => Promise<string[]>;
    removeAliases: (aliases: string[]) => Promise<string[]>;
    getEntityData: (id: string) => Promise<EntityData>;
}