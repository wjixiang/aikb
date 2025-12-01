import { killPort } from '@nx/node/utils';
import { cleanupTestDatabase } from './test-db-setup';
/* eslint-disable */

export default async function () {
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await killPort(port);

  // Kill the test service if it was started
  if (globalThis.__TEST_SERVICE_PROCESS__) {
    globalThis.__TEST_SERVICE_PROCESS__.kill();
  }

  // Clean up mock test database
  await cleanupTestDatabase();

  console.log(globalThis.__TEARDOWN_MESSAGE__);
}
