export type ReviewMode = "normal" | "unpracticed" | "review";

export interface quizSelector {
  cls: string[];
  randomize?: boolean;
  mode: string[];
  quizNum: number;
  unit: string[];
  source: string[];
  extractedYear: number[];
  onlyHasDone?: boolean;
  email?: string;
  reviewMode?: ReviewMode;
  startDate?: Date;
  endDate?: Date;
  scoringWeights?: {
    errorRate: number;
    consecutiveWrong: number;
    recency: number;
  };
  tags?: (string | { value: string; type?: "private" | "public" })[]; // 支持混合标签模式
  tagFilterMode?: "AND" | "OR"; // 新增：标签筛选模式
  excludeTags?: (string | { value: string; type?: "private" | "public" })[]; // 支持混合标签模式
  excludeTagFilterMode?: "AND" | "OR"; // 新增：排除标签筛选模式
}

export interface TagPreset {
  _id?: any; // MongoDB ObjectId
  name: string;
  description?: string;
  includeTags: string[];
  excludeTags: string[];
  includeTagFilterMode: "AND" | "OR";
  excludeTagFilterMode: "AND" | "OR";
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
  isDefault?: boolean;
}

export type TagPresetOperation = "create" | "update" | "delete" | "load";

export interface PublicTag {
  _id?: any; // MongoDB ObjectId
  name: string;
  description?: string;
  category?: string;
  color?: string;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CreatePublicTagRequest {
  name: string;
  description?: string;
  category?: string;
  color?: string;
}

export interface UpdatePublicTagRequest {
  name?: string;
  description?: string;
  category?: string;
  color?: string;
  isActive?: boolean;
}

export interface PublicTagStats {
  tagId: string;
  tagName: string;
  usageCount: number;
  lastUsed?: Date;
  createdBy: string;
  createdAt: Date;
}
