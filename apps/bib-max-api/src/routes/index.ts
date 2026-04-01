import type { FastifyInstance } from "fastify";
import { registerItemRoutes } from "./items.js";
import { registerTagRoutes } from "./tags.js";

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
}
