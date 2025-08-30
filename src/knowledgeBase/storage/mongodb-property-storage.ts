import createLoggerWithPrefix from '../logger';
import { connectToDatabase } from '../database/mongodb';
import { ObjectId } from 'mongodb';
import { AbstractPropertyStorage } from './abstract-storage';
import { PropertyData } from '../knowledge.type';

/**
 * Concrete implementation of PropertyStorage using MongoDB
 */
class MongodbPropertyStorage extends AbstractPropertyStorage {
  private collectionName = 'properties';

  logger = createLoggerWithPrefix('MongodbPropertyStorage');

  async create_property(property: PropertyData): Promise<PropertyData> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      // Convert name array to a string for unique indexing
      const propertyName = property.name.join('.');
      const propertyWithId = { ...property, propertyName };

      const result = await collection.insertOne(propertyWithId);
      this.logger.info(
        `Created property with _id: ${JSON.stringify(result.insertedId)}`,
      );

      return property;
    } catch (error) {
      this.logger.error('Failed to create property:', error);
      throw error;
    }
  }

  async get_property_by_name(name: string[]): Promise<PropertyData | null> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const propertyName = name.join('.');
      const property = await collection.findOne({
        propertyName,
      });

      if (property) {
        // Remove MongoDB-specific _id and propertyName fields before returning
        const { _id, propertyName, ...propertyData } = property;
        return propertyData as PropertyData;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get property by name:', error);
      throw error;
    }
  }

  async get_property_by_ids(ids: string[]): Promise<PropertyData[]> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const objectids = ids.map(e=>new ObjectId(e))

      const data = await collection.find({
        _id: {
          $in: objectids
        }
      }).toArray()

      // Remove MongoDB-specific _id and propertyName fields before returning
      const result = data.map(
        ({ _id, propertyName, ...propertyData }) =>
          propertyData as PropertyData,
      );

      this.logger.info(`Found ${result.length} properties by ids`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get properties by ids:', error);
      throw error;
    }
  }

  async update_property(property: PropertyData): Promise<PropertyData> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const propertyName = property.name.join('.');
      const updateResult = await collection.replaceOne(
        { propertyName },
        { ...property, propertyName },
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error(`PropertyData with name ${propertyName} not found`);
      }

      this.logger.info(`Updated property with name: ${propertyName}`);
      return property;
    } catch (error) {
      this.logger.error('Failed to update property:', error);
      throw error;
    }
  }

  async delete_property(name: string[]): Promise<boolean> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const propertyName = name.join('.');
      const deleteResult = await collection.deleteOne({
        propertyName,
      });

      if (deleteResult.deletedCount === 0) {
        this.logger.warn(
          `PropertyData with name ${propertyName} not found for deletion`,
        );
        return false;
      }

      this.logger.info(`Deleted property with name: ${propertyName}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete property:', error);
      throw error;
    }
  }

  async search_properties(query: string): Promise<PropertyData[]> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      // Search in propertyName and content fields
      const searchRegex = new RegExp(query, 'i');
      const properties = await collection
        .find({
          $or: [
            { propertyName: { $regex: searchRegex } },
            { content: { $regex: searchRegex } },
          ],
        })
        .toArray();

      // Remove MongoDB-specific _id and propertyName fields before returning
      const result = properties.map(
        ({ _id, propertyName, ...propertyData }) =>
          propertyData as PropertyData,
      );

      this.logger.info(
        `Found ${result.length} properties matching query: ${query}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to search properties:', error);
      throw error;
    }
  }

  async list_all_properties(): Promise<PropertyData[]> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const properties = await collection.find({}).toArray();

      // Remove MongoDB-specific _id and propertyName fields before returning
      const result = properties.map(
        ({ _id, propertyName, ...propertyData }) =>
          propertyData as PropertyData,
      );

      this.logger.info(`Listed ${result.length} properties`);
      return result;
    } catch (error) {
      this.logger.error('Failed to list all properties:', error);
      throw error;
    }
  }
}

export { MongodbPropertyStorage };
