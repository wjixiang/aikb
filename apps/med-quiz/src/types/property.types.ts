/**
 * EnhancedProperty represents a knowledge property with verification metadata
 */
export interface EnhancedProperty {
  /**
   * Unique identifier for the property
   */
  id: string;
  /**
   * Formal name of the property
   */
  prop_name: string;
  /**
   * The actual content or value of the property
   */
  content: string;
  /**
   * Confidence score (0-1) in the property's accuracy
   */
  confidence_score: number;
  /**
   * Questions used to verify this property's validity
   */
  verification_questions: string[];
  /**
   * Related entity IDs that reference this property
   */
  related_entities: string[];
  /**
   * Optional timestamp when this property was last verified
   */
  last_verified?: Date;
  /**
   * Number of times this property has been updated
   */
  update_count: number;
}
