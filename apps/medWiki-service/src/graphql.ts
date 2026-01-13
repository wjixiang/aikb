
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export enum documentType {
    property = "property",
    relation = "relation"
}

export class EntityWhereInput {
    id?: Nullable<string>;
    id_in?: Nullable<string[]>;
    id_not_in?: Nullable<string[]>;
    definition?: Nullable<string>;
    definition_semantic_search?: Nullable<SemanticSearchInput>;
    definition_contains?: Nullable<string>;
    definition_starts_with?: Nullable<string>;
    definition_ends_with?: Nullable<string>;
    definition_in?: Nullable<string[]>;
    definition_not_in?: Nullable<string[]>;
    nomenclature?: Nullable<NomenclatureWhereInput>;
    nomenclature_some?: Nullable<NomenclatureWhereInput>;
    nomenclature_every?: Nullable<NomenclatureWhereInput>;
    nomenclature_none?: Nullable<NomenclatureWhereInput>;
    AND?: Nullable<EntityWhereInput[]>;
    OR?: Nullable<EntityWhereInput[]>;
    NOT?: Nullable<EntityWhereInput>;
}

export class SemanticSearchInput {
    searchText: string;
    topK?: Nullable<number>;
    threshold?: Nullable<number>;
}

export class NomenclatureWhereInput {
    name?: Nullable<string>;
    name_contains?: Nullable<string>;
    name_starts_with?: Nullable<string>;
    name_ends_with?: Nullable<string>;
    name_in?: Nullable<string[]>;
    name_not_in?: Nullable<string[]>;
    acronym?: Nullable<string>;
    acronym_contains?: Nullable<string>;
    acronym_starts_with?: Nullable<string>;
    acronym_ends_with?: Nullable<string>;
    acronym_in?: Nullable<string[]>;
    acronym_not_in?: Nullable<string[]>;
    acronym_is_null?: Nullable<boolean>;
    language?: Nullable<string>;
    language_contains?: Nullable<string>;
    language_starts_with?: Nullable<string>;
    language_ends_with?: Nullable<string>;
    language_in?: Nullable<string[]>;
    language_not_in?: Nullable<string[]>;
    AND?: Nullable<NomenclatureWhereInput[]>;
    OR?: Nullable<NomenclatureWhereInput[]>;
    NOT?: Nullable<NomenclatureWhereInput>;
}

export class CreateEntityInput {
    nomenclature: NomenclatureInput[];
    definition: string;
}

export class NomenclatureInput {
    name: string;
    acronym?: Nullable<string>;
    language: string;
}

export class CreateDocumentInput {
    type: DocumentType;
    entities: string[];
    topic: string;
    content: string;
}

export class UpdateDocumentInput {
    documentId: string;
    type?: Nullable<DocumentType>;
    entities?: Nullable<Nullable<string>[]>;
    topic?: Nullable<string>;
    content?: Nullable<string>;
}

export class DeleteDocumentInput {
    documentId: string;
}

export class DocumentWhereInput {
    id?: Nullable<string>;
    id_in?: Nullable<string[]>;
    id_not_in?: Nullable<string[]>;
    type?: Nullable<DocumentType>;
    type_in?: Nullable<DocumentType[]>;
    type_not_in?: Nullable<DocumentType[]>;
    entities?: Nullable<string>;
    entities_in?: Nullable<string[]>;
    entities_not_in?: Nullable<string[]>;
    entities_contains?: Nullable<string>;
    entities_starts_with?: Nullable<string>;
    entities_ends_with?: Nullable<string>;
    topic?: Nullable<string>;
    topic_contains?: Nullable<string>;
    topic_starts_with?: Nullable<string>;
    topic_ends_with?: Nullable<string>;
    topic_in?: Nullable<string[]>;
    topic_not_in?: Nullable<string[]>;
    topic_semantic_search?: Nullable<SemanticSearchInput>;
    metadata?: Nullable<DocumentMetadataWhereInput>;
    record?: Nullable<DocumentRecordWhereInput>;
    record_some?: Nullable<DocumentRecordWhereInput>;
    record_every?: Nullable<DocumentRecordWhereInput>;
    record_none?: Nullable<DocumentRecordWhereInput>;
    record_semantic_search?: Nullable<SemanticSearchInput>;
    AND?: Nullable<DocumentWhereInput[]>;
    OR?: Nullable<DocumentWhereInput[]>;
    NOT?: Nullable<DocumentWhereInput>;
}

export class DocumentMetadataWhereInput {
    tags?: Nullable<string>;
    tags_in?: Nullable<string[]>;
    tags_not_in?: Nullable<string[]>;
    tags_contains?: Nullable<string>;
    tags_starts_with?: Nullable<string>;
    tags_ends_with?: Nullable<string>;
    tags_is_null?: Nullable<boolean>;
    AND?: Nullable<DocumentMetadataWhereInput[]>;
    OR?: Nullable<DocumentMetadataWhereInput[]>;
    NOT?: Nullable<DocumentMetadataWhereInput>;
}

export class DocumentRecordWhereInput {
    topic?: Nullable<string>;
    topic_contains?: Nullable<string>;
    topic_starts_with?: Nullable<string>;
    topic_ends_with?: Nullable<string>;
    topic_in?: Nullable<string[]>;
    topic_not_in?: Nullable<string[]>;
    content?: Nullable<string>;
    content_contains?: Nullable<string>;
    content_starts_with?: Nullable<string>;
    content_ends_with?: Nullable<string>;
    content_in?: Nullable<string[]>;
    content_not_in?: Nullable<string[]>;
    updateDate?: Nullable<string>;
    updateDate_in?: Nullable<string[]>;
    updateDate_not_in?: Nullable<string[]>;
    AND?: Nullable<DocumentRecordWhereInput[]>;
    OR?: Nullable<DocumentRecordWhereInput[]>;
    NOT?: Nullable<DocumentRecordWhereInput>;
}

export abstract class IQuery {
    abstract entities(where?: Nullable<EntityWhereInput>): Nullable<Entity>[] | Promise<Nullable<Entity>[]>;

    abstract entity(where?: Nullable<EntityWhereInput>): Nullable<Entity> | Promise<Nullable<Entity>>;

    abstract documents(where?: Nullable<DocumentWhereInput>): Nullable<Document>[] | Promise<Nullable<Document>[]>;

    abstract document(where?: Nullable<DocumentWhereInput>): Nullable<Document> | Promise<Nullable<Document>>;
}

export abstract class IMutation {
    abstract createEntity(input?: Nullable<CreateEntityInput>): Nullable<Entity> | Promise<Nullable<Entity>>;

    abstract createDocument(input?: Nullable<CreateDocumentInput>): Nullable<Document> | Promise<Nullable<Document>>;

    abstract updateDocument(input?: Nullable<UpdateDocumentInput>): Nullable<Document> | Promise<Nullable<Document>>;

    abstract deleteDocument(input?: Nullable<DeleteDocumentInput>): Nullable<Document> | Promise<Nullable<Document>>;
}

export class Entity {
    id: string;
    nomenclature: Nomenclature[];
    definition: string;
}

export class Nomenclature {
    name: string;
    acronym?: Nullable<string>;
    language: string;
}

export class Document {
    id: string;
    type: DocumentType;
    entities: string[];
    topic: string;
    metadata?: Nullable<DocumentMetadata>;
    record: Nullable<DocumentRecord>[];
}

export class DocumentMetadata {
    tags?: Nullable<Nullable<string>[]>;
}

export class DocumentRecord {
    topic: string;
    content: string;
    updateDate: string;
}

type Nullable<T> = T | null;
