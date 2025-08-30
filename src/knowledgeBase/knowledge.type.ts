/**
 * 实体为一个"点"，通过以下多个坐标对其进行定位
 */
export interface EntityData {
  name: string[];
  tags: string[];
  definition: string;
  propertyBindIds: string[];
}

export interface EntityDataWithId extends EntityData {
  id: string;
}

export interface PropertyData {
  name: string[];
  content: string;
}

export interface PropertyDataWithId extends PropertyData {
  id: string;
}