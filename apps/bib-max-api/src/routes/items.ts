import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import {
  CreateItemSchema,
  UpdateItemSchema,
  ItemQuerySchema,
  SetItemTagsSchema,
  BatchOperationSchema,
  PaginatedItemsSchema,
  ItemSchema,
} from "../schemas/item.schema.js";

const IdParam = Type.Object({
  id: Type.String({ format: "uuid", description: "记录 ID" }),
});

const DeletedResponse = Type.Object({
  success: Type.Boolean({ description: "操作是否成功" }),
  id: Type.String({ format: "uuid", description: "被删除的记录 ID" }),
}, { description: "删除响应" });

const BatchResponse = Type.Object({
  success: Type.Boolean({ description: "操作是否成功" }),
  updated: Type.Integer({ description: "受影响的记录数" }),
  deleted: Type.Optional(Type.Integer({ description: "删除的记录数（仅 delete 操作返回）" })),
}, { description: "批量操作响应" });

const ErrorResponse = Type.Object({
  statusCode: Type.Integer({ description: "HTTP 状态码" }),
  error: Type.String({ description: "错误类型" }),
  message: Type.String({ description: "错误描述" }),
}, { description: "错误响应" });

function formatItem(item: {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  abstract: string | null;
  year: number | null;
  source: string | null;
  doi: string | null;
  isbn: string | null;
  pmid: bigint | null;
  url: string | null;
  coverUrl: string | null;
  notes: string | null;
  isFavorite: boolean;
  isRead: boolean;
  rating: number | null;
  customMeta: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: Array<{ tag: { id: string; name: string; color: string | null; description: string | null } }>;
}) {
  return {
    ...item,
    pmid: item.pmid?.toString() ?? null,
    tags: item.tags?.map((it) => it.tag) ?? [],
  };
}

export async function registerItemRoutes(app: FastifyInstance) {
  app.get(
    "/items",
    {
      schema: {
        querystring: ItemQuerySchema,
        response: { 200: PaginatedItemsSchema },
        tags: ["Items"],
        summary: "获取文献/书籍列表",
        description: "分页查询文献列表，支持按关键词搜索、标签筛选、收藏/已读过滤和排序。搜索范围包括标题、副标题、作者、来源和 DOI。",
      },
    },
    async (request) => {
      const query = request.query as {
        page?: number;
        pageSize?: number;
        type?: string;
        search?: string;
        tagIds?: string[];
        isFavorite?: boolean;
        isRead?: boolean;
        sortBy?: string;
        sortOrder?: string;
      };

      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      const sortBy = query.sortBy ?? "createdAt";
      const sortOrder = query.sortOrder ?? "desc";
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {};
      if (query.type) where.type = query.type;
      if (query.isFavorite !== undefined) where.isFavorite = query.isFavorite;
      if (query.isRead !== undefined) where.isRead = query.isRead;

      if (query.search) {
        where.OR = [
          { title: { contains: query.search, mode: "insensitive" } },
          { subtitle: { contains: query.search, mode: "insensitive" } },
          { authors: { has: query.search } },
          { source: { contains: query.search, mode: "insensitive" } },
          { doi: { contains: query.search, mode: "insensitive" } },
        ];
      }

      if (query.tagIds && query.tagIds.length > 0) {
        where.tags = {
          some: {
            tagId: { in: query.tagIds },
          },
        };
      }

      const orderBy = { [sortBy]: sortOrder } as Record<string, string>;

      const [items, total] = await Promise.all([
        prisma.item.findMany({
          where,
          skip,
          take: pageSize,
          orderBy,
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
          },
        }),
        prisma.item.count({ where }),
      ]);

      return {
        data: items.map(formatItem),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    },
  );

  app.post(
    "/items",
    {
      schema: {
        body: CreateItemSchema,
        response: { 201: ItemSchema },
        tags: ["Items"],
        summary: "创建文献/书籍",
        description: "新增一条文献或书籍记录，可同时关联已有标签。pmid 字段请传入字符串形式的数字。",
      },
    },
    async (request, reply) => {
      const body = request.body as {
        tagIds?: string[];
        pmid?: string;
        type?: string;
        title: string;
        subtitle?: string;
        authors?: string[];
        abstract?: string;
        year?: number;
        source?: string;
        doi?: string;
        isbn?: string;
        url?: string;
        coverUrl?: string;
        notes?: string;
        isFavorite?: boolean;
        isRead?: boolean;
        rating?: number;
        customMeta?: Prisma.InputJsonValue;
      };

      const { tagIds = [], pmid, ...data } = body;

      const item = await prisma.item.create({
        data: {
          ...data,
          pmid: pmid ? BigInt(pmid) : null,
          tags: {
            create: tagIds.map((tagId) => ({ tagId })),
          },
        },
        include: {
          tags: { include: { tag: true } },
        },
      });

      reply.status(201);
      return formatItem(item);
    },
  );

  app.get(
    "/items/:id",
    {
      schema: {
        params: IdParam,
        response: { 200: ItemSchema, 404: ErrorResponse },
        tags: ["Items"],
        summary: "获取文献/书籍详情",
        description: "根据 ID 获取单条文献详情，包含关联标签信息。",
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const item = await prisma.item.findUnique({
        where: { id },
        include: { tags: { include: { tag: true } } },
      });

      if (!item) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Item with id ${id} not found`,
        } as any);
      }

      return formatItem(item);
    },
  );

  app.put(
    "/items/:id",
    {
      schema: {
        params: IdParam,
        body: UpdateItemSchema,
        response: { 200: ItemSchema, 404: ErrorResponse },
        tags: ["Items"],
        summary: "更新文献/书籍",
        description: "根据 ID 更新文献信息。若传入 tagIds，将替换全部现有标签。",
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        tagIds?: string[];
        pmid?: string;
        [key: string]: unknown;
      };

      const existing = await prisma.item.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Item with id ${id} not found`,
        } as any);
      }

      const { tagIds, pmid, ...data } = body;
      const updateData: Record<string, unknown> = { ...data };
      if (pmid !== undefined) {
        updateData.pmid = pmid ? BigInt(pmid) : null;
      }

      if (tagIds !== undefined) {
        await prisma.itemTag.deleteMany({ where: { itemId: id } });
        await prisma.item.update({
          where: { id },
          data: {
            ...updateData,
            tags: {
              create: tagIds.map((tagId: string) => ({ tagId })),
            },
          },
        });
      } else {
        await prisma.item.update({
          where: { id },
          data: updateData,
        });
      }

      const item = await prisma.item.findUnique({
        where: { id },
        include: { tags: { include: { tag: true } } },
      });

      return formatItem(item!);
    },
  );

  app.delete(
    "/items/:id",
    {
      schema: {
        params: IdParam,
        response: { 200: DeletedResponse, 404: ErrorResponse },
        tags: ["Items"],
        summary: "删除文献/书籍",
        description: "根据 ID 删除一条文献，同时移除其所有标签关联。",
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.item.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Item with id ${id} not found`,
        } as any);
      }

      await prisma.item.delete({ where: { id } });
      return { success: true, id };
    },
  );

  app.patch(
    "/items/:id/tags",
    {
      schema: {
        params: IdParam,
        body: SetItemTagsSchema,
        response: { 200: ItemSchema, 404: ErrorResponse },
        tags: ["Items"],
        summary: "设置文献/书籍标签",
        description: "替换指定文献的全部标签。传入的 tagIds 将完全覆盖原有标签关联。",
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tagIds } = request.body as { tagIds: string[] };

      const existing = await prisma.item.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Item with id ${id} not found`,
        } as any);
      }

      await prisma.itemTag.deleteMany({ where: { itemId: id } });
      await prisma.item.update({
        where: { id },
        data: {
          tags: {
            create: tagIds.map((tagId) => ({ tagId })),
          },
        },
      });

      const item = await prisma.item.findUnique({
        where: { id },
        include: { tags: { include: { tag: true } } },
      });

      return formatItem(item!);
    },
  );

  app.post(
    "/items/batch",
    {
      schema: {
        body: BatchOperationSchema,
        response: { 200: BatchResponse, 400: ErrorResponse },
        tags: ["Items"],
        summary: "批量操作",
        description: `对多条文献执行批量操作，支持以下类型：
- **delete**: 批量删除文献及其标签关联
- **setTags**: 替换所有指定文献的标签（需传 tagIds）
- **addTags**: 为指定文献追加标签（需传 tagIds，自动去重）
- **removeTags**: 移除指定文献的特定标签（需传 tagIds）
- **markAsRead**: 标记为已读
- **markAsUnread**: 标记为未读
- **toggleFavorite**: 切换收藏状态`,
      },
    },
    async (request, reply) => {
      const { itemIds, operation, tagIds } = request.body as {
        itemIds: string[];
        operation: string;
        tagIds?: string[];
      };

      switch (operation) {
        case "delete": {
          await prisma.itemTag.deleteMany({
            where: { itemId: { in: itemIds } },
          });
          const result = await prisma.item.deleteMany({
            where: { id: { in: itemIds } },
          });
          return { success: true, updated: 0, deleted: result.count };
        }

        case "setTags": {
          if (!tagIds) {
            return reply.status(400).send({
              statusCode: 400,
              error: "Bad Request",
              message: "tagIds is required for setTags operation",
            } as any);
          }
          await prisma.$transaction(
            itemIds.map((itemId) =>
              prisma.itemTag.deleteMany({ where: { itemId } }),
            ),
          );
          await prisma.itemTag.createMany({
            data: itemIds.flatMap((itemId) =>
              tagIds.map((tagId) => ({ itemId, tagId })),
            ),
          });
          return { success: true, updated: itemIds.length };
        }

        case "addTags": {
          if (!tagIds) {
            return reply.status(400).send({
              statusCode: 400,
              error: "Bad Request",
              message: "tagIds is required for addTags operation",
            } as any);
          }
          await prisma.itemTag.createMany({
            data: itemIds.flatMap((itemId) =>
              tagIds.map((tagId) => ({ itemId, tagId })),
            ),
            skipDuplicates: true,
          });
          return { success: true, updated: itemIds.length };
        }

        case "removeTags": {
          if (!tagIds) {
            return reply.status(400).send({
              statusCode: 400,
              error: "Bad Request",
              message: "tagIds is required for removeTags operation",
            } as any);
          }
          await prisma.itemTag.deleteMany({
            where: {
              itemId: { in: itemIds },
              tagId: { in: tagIds },
            },
          });
          return { success: true, updated: itemIds.length };
        }

        case "markAsRead": {
          await prisma.item.updateMany({
            where: { id: { in: itemIds } },
            data: { isRead: true },
          });
          return { success: true, updated: itemIds.length };
        }

        case "markAsUnread": {
          await prisma.item.updateMany({
            where: { id: { in: itemIds } },
            data: { isRead: false },
          });
          return { success: true, updated: itemIds.length };
        }

        case "toggleFavorite": {
          const items = await prisma.item.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, isFavorite: true },
          });
          await prisma.$transaction(
            items.map((item: { id: string; isFavorite: boolean }) =>
              prisma.item.update({
                where: { id: item.id },
                data: { isFavorite: !item.isFavorite },
              }),
            ),
          );
          return { success: true, updated: items.length };
        }

        default:
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: `Unknown operation: ${operation}`,
          } as any);
      }
    },
  );
}
