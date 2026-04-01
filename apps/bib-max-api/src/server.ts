import { createApp } from "./index.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

async function main() {
  const app = await createApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Server running at http://${config.host}:${config.port}`);
    console.log(`Swagger docs at http://${config.host}:${config.port}/documentation`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
