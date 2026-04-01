import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { prisma } from "../db.js";
import {
  CreateTagSchema,
  UpdateTagSchema,
  TagQuerySchema,
  PaginatedTagsSchema,
  TagSchema,
} from "../schemas/tag.schema.js";

const IdParam = Type.Object({
  id: Type.String({ format: "uuid", description: "标签 ID" }),
});

const ErrorResponse = Type.Object({
  statusCode: Type.Integer({ description: "HTTP 状态码" }),
  error: Type.String({ description: "错误类型" }),
  message: Type.String({ description: "错误描述" }),
}, { description: "错误响应" });

const DeletedResponse = Type.Object({
  success: Type.Boolean({ description: "操作是否成功" }),
  id: Type.String({ format: "uuid", description: "被删除的标签 ID" }),
}, { description: "删除响应" });

export async function registerTagRoutes(app: FastifyInstance) {
  app.get(
    "/tags",
    {
      schema: {
        querystring: TagQuerySchema,
        response: { 200: PaginatedTagsSchema },
        tags: ["Tags"],
        summary: "获取标签列表",
        description: "分页查询标签列表，支持按关键词搜索标签名称和描述。设置 withCount=true 可返回每个标签关联的文献数量。",
      },
    },
    async (request) => {
      const query = request.query as {
        page?: number;
        pageSize?: number;
        search?: string;
        withCount?: boolean;
      };

      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 50;
      const withCount = query.withCount ?? false;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {};
      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ];
      }

      const [tags, total] = await Promise.all([
        prisma.tag.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: withCount
            ? {
                _count: {
                  select: { items: true },
                },
              }
            : undefined,
        }),
        prisma.tag.count({ where }),
      ]);

      return {
        data: tags.map((tag: Record<string, unknown>) => ({
          ...tag,
          itemCount: withCount ? (tag._count as Record<string, unknown>)?.items : undefined,
          _count: undefined,
        })),
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
    "/tags",
    {
      schema: {
        body: CreateTagSchema,
        response: { 201: TagSchema },
        tags: ["Tags"],
        summary: "创建标签",
        description: "新增一个标签。标签名称不可重复。",
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        color?: string;
        description?: string;
      };

      const tag = await prisma.tag.create({
        data: body,
      });

      reply.status(201);
      return tag;
    },
  );

  app.get(
    "/tags/:id",
    {
      schema: {
        params: IdParam,
        response: { 200: TagSchema, 404: ErrorResponse },
        tags: ["Tags"],
        summary: "获取标签详情",
        description: "根据 ID 获取标签详情，包含关联文献数量。",
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tag = await prisma.tag.findUnique({
        where: { id },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      if (!tag) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Tag with id ${id} not found`,
        } as any);
      }

      const { _count, ...tagData } = tag;
      return { ...tagData, itemCount: _count?.items };
    },
  );

  app.put(
    "/tags/:id",
    {
      schema: {
        params: IdParam,
        body: UpdateTagSchema,
        response: { 200: TagSchema, 404: ErrorResponse },
        tags: ["Tags"],
        summary: "更新标签",
        description: "根据 ID 更新标签信息。若更新名称，新名称不可与已有标签重复。",
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        color?: string;
        description?: string;
      };

      const existing = await prisma.tag.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Tag with id ${id} not found`,
        } as any);
      }

      const tag = await prisma.tag.update({
        where: { id },
        data: body,
      });

      return tag;
    },
  );

  app.delete(
    "/tags/:id",
    {
      schema: {
        params: IdParam,
        response: { 200: DeletedResponse, 404: ErrorResponse },
        tags: ["Tags"],
        summary: "删除标签",
        description: "根据 ID 删除标签，同时自动移除所有文献与该标签的关联。",
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.tag.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Tag with id ${id} not found`,
        } as any);
      }

      await prisma.tag.delete({ where: { id } });
      return { success: true, id };
    },
  );
}
