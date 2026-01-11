
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export class EntityWhereInput {
    id?: Nullable<string>;
    id_in?: Nullable<string[]>;
    id_not_in?: Nullable<string[]>;
    definition?: Nullable<string>;
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

export abstract class IQuery {
    abstract entities(where?: Nullable<EntityWhereInput>): Entity[] | Promise<Entity[]>;

    abstract entity(where?: Nullable<EntityWhereInput>): Nullable<Entity> | Promise<Nullable<Entity>>;
}

export abstract class IMutation {
    abstract createEntity(input?: Nullable<CreateEntityInput>): Nullable<Entity> | Promise<Nullable<Entity>>;
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

type Nullable<T> = T | null;
