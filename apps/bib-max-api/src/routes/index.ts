import type { FastifyInstance } from "fastify";
import { registerItemRoutes } from "./items.js";
import { registerTagRoutes } from "./tags.js";
import { registerAttachmentRoutes } from "./attachments.js";
import { registerChatRoutes } from "./chat.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(
    async (itemApp) => {
      registerItemRoutes(itemApp);
    },
    { prefix: "/api" },
  );

  await app.register(
    async (tagApp) => {
      registerTagRoutes(tagApp);
    },
    { prefix: "/api" },
  );

  await app.register(
    async (attachmentApp) => {
      registerAttachmentRoutes(attachmentApp);
    },
    { prefix: "/api" },
  );

  await app.register(
    async (chatApp) => {
      registerChatRoutes(chatApp);
    },
    { prefix: "/api" },
  );
}
