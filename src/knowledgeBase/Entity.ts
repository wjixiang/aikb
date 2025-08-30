import { EntityData } from './knowledge.type';
import { Property } from './Property';
import { KnowledgeStorage } from './storage/storage';

export default class Entity {
  data: EntityData;
  property: Property;

  constructor(
    data: EntityData,
    private knowledgeStorage: KnowledgeStorage,
  ) {
    this.data = data;
  }

  async load_property() {
    const propertyDataList = await this.knowledgeStorage.propertyStorage.get_property_by_ids(this.data.propertyBindIds);
    return propertyDataList.map(propertyData => new Property(propertyData));
  }
}
