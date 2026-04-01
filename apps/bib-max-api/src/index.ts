import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { config } from "./config.js";
import { registerRoutes } from "./routes/index.js";
import { swaggerOptions } from "./plugins/swagger.js";

export async function createApp() {
  const app = Fastify({
    logger: {
      level: "info",
      transport:
        process.env["NODE_ENV"] === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(cors as any, {
    origin: config.corsOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  await app.register(swagger as any, swaggerOptions);
  await app.register(swaggerUi as any, { routePrefix: "/documentation" });

  registerRoutes(app);

  app.setErrorHandler((err: unknown, _request, reply) => {
    const error = err as FastifyError & { validation?: unknown };
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Validation error",
        details: error.validation,
      });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "An unexpected error occurred",
      });
    }

    reply.status(statusCode).send({
      statusCode,
      error: error.code ?? "Error",
      message: error.message,
    });
  });

  return app;
}
