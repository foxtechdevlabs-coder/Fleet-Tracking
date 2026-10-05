// HTTP server bootstrap.
import type { Server } from "node:http";
import { MikroORM } from "@mikro-orm/postgresql";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import mikroOrmConfig from "./database/mikro-orm.config.js";

async function bootstrap(): Promise<void> {
  const orm = await MikroORM.init(mikroOrmConfig);
  // connect() only creates the pool; checkConnection() does a real round-trip.
  await orm.connect();
  const connection = await orm.checkConnection();
  if (!connection.ok) {
    await orm.close(true);
    throw new Error(
      `Database connection failed${connection.reason ? `: ${connection.reason}` : ""}`,
      { cause: connection.error },
    );
  }
  console.log("Database connected");

  const app = createApp(orm);
  const server = await new Promise<Server>((resolve, reject) => {
    const httpServer = app.listen(env.port, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(httpServer);
      }
    });
  }).catch(async (error: unknown) => {
    await orm.close(true);
    throw error;
  });
  console.log(`Server listening on port ${env.port} (${env.nodeEnv})`);

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await orm.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
