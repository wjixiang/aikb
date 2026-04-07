import type { FastifyInstance } from "fastify";
import { registerTagRoutes } from "./tags.js";
import { registerChatRoutes } from "./chat.js";
import { registerExtractMetadataRoute } from "./extract-metadata.js";
import { registerConvertAttachmentRoute } from "./convert-attachment.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(
    async (tagApp) => {
      registerTagRoutes(tagApp);
    },
    { prefix: "/api" },
  );

  await app.register(
    async (extractApp) => {
      registerExtractMetadataRoute(extractApp);
    },
    { prefix: "/api" },
  );

  await app.register(
    async (chatApp) => {
      registerChatRoutes(chatApp);
    },
    { prefix: "/api" },
  );

  await app.register(
    async (convertApp) => {
      registerConvertAttachmentRoute(convertApp);
    },
    { prefix: "/api" },
  );
}
