/**
 * 实体为一个"点"，通过以下多个坐标对其进行定位
 */
export interface EntityData {
  name: string[];
  tags: string[];
  definition: string;
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

export interface Knowledge {
  id: string;
  scopePath: {
    entities: string[];
    scopes: string[][];
  };
  content: string;
  metadata: {
    tags: string;
    createDate: Date;

  }
}
