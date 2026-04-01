import { Type } from "@sinclair/typebox";

export const TagSchema = Type.Object(
  {
    id: Type.String({ format: "uuid", description: "唯一标识符" }),
    name: Type.String({ description: "标签名称" }),
    color: Type.Optional(Type.String({ description: "标签颜色 (HEX)，如 #FF5733" })),
    description: Type.Optional(Type.String({ description: "标签描述" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    itemCount: Type.Optional(Type.Integer({ description: "关联文献数量（仅查询时附带 withCount=true 返回）" })),
  },
  { description: "标签详情" },
);

export const CreateTagSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, description: "标签名称（必填）" }),
    color: Type.Optional(Type.String({ description: "标签颜色 (HEX)，如 #FF5733" })),
    description: Type.Optional(Type.String({ description: "标签描述" })),
  },
  { description: "创建标签请求体" },
);

export const UpdateTagSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, description: "标签名称" })),
    color: Type.Optional(Type.String({ description: "标签颜色 (HEX)" })),
    description: Type.Optional(Type.String({ description: "标签描述" })),
  },
  { description: "更新标签请求体（所有字段可选）" },
);

export const TagQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1, description: "页码" })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50, description: "每页数量" })),
    search: Type.Optional(Type.String({ description: "搜索关键词（匹配标签名称和描述）" })),
    withCount: Type.Optional(Type.Boolean({ description: "是否返回关联文献数量" })),
  },
  { description: "标签列表查询参数" },
);

export const PaginatedTagsSchema = Type.Object(
  {
    data: Type.Array(TagSchema, { description: "标签列表" }),
    pagination: Type.Object(
      {
        page: Type.Integer({ description: "当前页码" }),
        pageSize: Type.Integer({ description: "每页数量" }),
        total: Type.Integer({ description: "总记录数" }),
        totalPages: Type.Integer({ description: "总页数" }),
      },
      { description: "分页信息" },
    ),
  },
  { description: "分页标签列表响应" },
);
