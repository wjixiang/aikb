import type { FastifyDynamicSwaggerOptions } from "@fastify/swagger";

export const swaggerOptions: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: "Bib Max API",
      description:
        "文献/书籍管理系统 API — 提供文献和书籍的 CRUD 管理、智能标签化分类、批量操作等功能。所有数据扁平存储，通过标签实现灵活分类。",
      version: "1.0.0",
      contact: {
        name: "AIKB Team",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development",
      },
    ],
    tags: [
      {
        name: "Items",
        description: "文献/书籍管理 — 支持论文(article)和书籍(book)两种类型的增删改查、搜索、标签关联和批量操作",
      },
      {
        name: "Tags",
        description: "标签管理 — 创建和管理分类标签，支持搜索和文献数量统计",
      },
    ],
  },
};
