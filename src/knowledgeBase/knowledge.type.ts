import { ObjectId } from "mongodb";

/**
 * 实体为一个"点"，通过以下多个坐标对其进行定位
 */
export interface Entity {
  name: string[];
  tags: string[];
  definition: string;
}

export interface EntityWithId extends Entity  {
  id: ObjectId
}

export interface Property {
  name: string[];
  content: string;
}