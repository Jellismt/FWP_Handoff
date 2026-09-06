/**
 * @file index.ts
 * @module engage-mt/server
 * @description Boot entrypoint. Container start command is
 *              `node dist/db/migrate.js up && node dist/index.js` — migrations run
 *              first, then the server listens on $PORT. Graceful shutdown closes the pool.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { closePool } from "./db/pool.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} received — shutting down`);
    await app.close();
    await closePool();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await app.listen({ port: cfg.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error("Fatal boot error:", err);
  process.exit(1);
});
