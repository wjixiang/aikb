import { Type } from "@sinclair/typebox";

export const ItemType = Type.Union(
  [Type.Literal("article"), Type.Literal("book")],
  { description: "文献类型：article(论文) 或 book(书籍)" },
);

export const ItemSchema = Type.Object(
  {
    id: Type.String({ format: "uuid", description: "唯一标识符" }),
    type: ItemType,
    title: Type.String({ description: "标题" }),
    subtitle: Type.Optional(Type.String({ description: "副标题" })),
    authors: Type.Array(Type.String(), { description: "作者列表" }),
    abstract: Type.Optional(Type.String({ description: "摘要" })),
    year: Type.Optional(Type.Integer({ description: "发表/出版年份" })),
    source: Type.Optional(Type.String({ description: "来源，如期刊名称或出版社" })),
    doi: Type.Optional(Type.String({ description: "DOI 标识符" })),
    isbn: Type.Optional(Type.String({ description: "ISBN 编号" })),
    pmid: Type.Optional(Type.String({ description: "PubMed ID" })),
    url: Type.Optional(Type.String({ format: "uri", description: "原文链接" })),
    coverUrl: Type.Optional(Type.String({ format: "uri", description: "封面图片 URL" })),
    notes: Type.Optional(Type.String({ description: "个人笔记" })),
    isFavorite: Type.Boolean({ description: "是否收藏" }),
    isRead: Type.Boolean({ description: "是否已读" }),
    rating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, description: "评分 1-5" })),
    customMeta: Type.Optional(Type.Any({ description: "自定义元数据 (JSON)" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
    tags: Type.Array(
      Type.Object({
        id: Type.String({ format: "uuid", description: "标签 ID" }),
        name: Type.String({ description: "标签名称" }),
        color: Type.Optional(Type.String({ description: "标签颜色 (HEX)" })),
        description: Type.Optional(Type.String({ description: "标签描述" })),
      }),
      { description: "关联标签列表" },
    ),
  },
  { description: "文献/书籍详情" },
);

export const CreateItemSchema = Type.Object(
  {
    type: Type.Optional(ItemType),
    title: Type.String({ minLength: 1, description: "标题（必填）" }),
    subtitle: Type.Optional(Type.String({ description: "副标题" })),
    authors: Type.Optional(Type.Array(Type.String(), { description: "作者列表" })),
    abstract: Type.Optional(Type.String({ description: "摘要" })),
    year: Type.Optional(Type.Integer({ minimum: 1000, maximum: 9999, description: "发表/出版年份" })),
    source: Type.Optional(Type.String({ description: "来源" })),
    doi: Type.Optional(Type.String({ description: "DOI 标识符" })),
    isbn: Type.Optional(Type.String({ description: "ISBN 编号" })),
    pmid: Type.Optional(Type.String({ description: "PubMed ID" })),
    url: Type.Optional(Type.String({ format: "uri", description: "原文链接" })),
    coverUrl: Type.Optional(Type.String({ format: "uri", description: "封面图片 URL" })),
    notes: Type.Optional(Type.String({ description: "个人笔记" })),
    isFavorite: Type.Optional(Type.Boolean({ description: "是否收藏" })),
    isRead: Type.Optional(Type.Boolean({ description: "是否已读" })),
    rating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, description: "评分 1-5" })),
    customMeta: Type.Optional(Type.Any({ description: "自定义元数据 (JSON)" })),
    tagIds: Type.Optional(Type.Array(Type.String({ format: "uuid" }), { description: "关联标签 ID 列表" })),
  },
  { description: "创建文献/书籍请求体" },
);

export const UpdateItemSchema = Type.Object(
  {
    type: Type.Optional(ItemType),
    title: Type.Optional(Type.String({ minLength: 1, description: "标题" })),
    subtitle: Type.Optional(Type.String({ description: "副标题" })),
    authors: Type.Optional(Type.Array(Type.String(), { description: "作者列表" })),
    abstract: Type.Optional(Type.String({ description: "摘要" })),
    year: Type.Optional(Type.Integer({ minimum: 1000, maximum: 9999, description: "发表/出版年份" })),
    source: Type.Optional(Type.String({ description: "来源" })),
    doi: Type.Optional(Type.String({ description: "DOI 标识符" })),
    isbn: Type.Optional(Type.String({ description: "ISBN 编号" })),
    pmid: Type.Optional(Type.String({ description: "PubMed ID" })),
    url: Type.Optional(Type.String({ format: "uri", description: "原文链接" })),
    coverUrl: Type.Optional(Type.String({ format: "uri", description: "封面图片 URL" })),
    notes: Type.Optional(Type.String({ description: "个人笔记" })),
    isFavorite: Type.Optional(Type.Boolean({ description: "是否收藏" })),
    isRead: Type.Optional(Type.Boolean({ description: "是否已读" })),
    rating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, description: "评分 1-5" })),
    customMeta: Type.Optional(Type.Any({ description: "自定义元数据 (JSON)" })),
    tagIds: Type.Optional(Type.Array(Type.String({ format: "uuid" }), { description: "关联标签 ID 列表，传入则替换全部标签" })),
  },
  { description: "更新文献/书籍请求体（所有字段可选）" },
);

export const ItemQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1, description: "页码" })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20, description: "每页数量" })),
    type: Type.Optional(ItemType),
    search: Type.Optional(Type.String({ description: "搜索关键词（匹配标题、副标题、作者、来源、DOI）" })),
    tagIds: Type.Optional(Type.Array(Type.String({ format: "uuid" }), { description: "按标签 ID 筛选，多选为 AND 关系" })),
    isFavorite: Type.Optional(Type.Boolean({ description: "筛选收藏状态" })),
    isRead: Type.Optional(Type.Boolean({ description: "筛选已读状态" })),
    sortBy: Type.Optional(
      Type.Union([
        Type.Literal("createdAt"),
        Type.Literal("updatedAt"),
        Type.Literal("year"),
        Type.Literal("title"),
      ], { description: "排序字段", default: "createdAt" }),
    ),
    sortOrder: Type.Optional(
      Type.Union([Type.Literal("asc"), Type.Literal("desc")], { description: "排序方向", default: "desc" }),
    ),
  },
  { description: "文献列表查询参数" },
);

export const SetItemTagsSchema = Type.Object(
  {
    tagIds: Type.Array(Type.String({ format: "uuid" }), { description: "标签 ID 列表，将替换原有标签" }),
  },
  { description: "设置文献标签请求体" },
);

export const BatchOperationSchema = Type.Object(
  {
    itemIds: Type.Array(Type.String({ format: "uuid" }), { minItems: 1, description: "目标文献 ID 列表" }),
    operation: Type.Union(
      [
        Type.Literal("addTags"),
        Type.Literal("removeTags"),
        Type.Literal("setTags"),
        Type.Literal("delete"),
        Type.Literal("markAsRead"),
        Type.Literal("markAsUnread"),
        Type.Literal("toggleFavorite"),
      ],
      { description: "批量操作类型" },
    ),
    tagIds: Type.Optional(Type.Array(Type.String({ format: "uuid" }), { description: "标签 ID 列表（addTags/removeTags/setTags 操作必填）" })),
  },
  { description: "批量操作请求体" },
);

export const PaginatedItemsSchema = Type.Object(
  {
    data: Type.Array(ItemSchema, { description: "文献列表" }),
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
  { description: "分页文献列表响应" },
);
