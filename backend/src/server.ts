// HTTP server bootstrap.
import { createServer } from "node:http";
import { MikroORM } from "@mikro-orm/postgresql";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import mikroOrmConfig from "./database/mikro-orm.config.js";
import { createSocketServer } from "./modules/realtime/socket.server.js";

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

  // One HTTP server serves both Express and Socket.IO (path /socket.io) on env.port.
  const app = createApp(orm);
  const httpServer = createServer(app);
  const { io, realtime } = createSocketServer(httpServer, () => orm.em.fork());
  app.locals.realtime = realtime;

  await new Promise<void>((resolve, reject) => {
    // http.Server reports listen failures (e.g. EADDRINUSE) as an "error" event.
    httpServer.once("error", reject);
    httpServer.listen(env.port, () => {
      httpServer.off("error", reject);
      resolve();
    });
  }).catch(async (error: unknown) => {
    io.close();
    await orm.close(true);
    throw error;
  });
  console.log(`Server listening on port ${env.port} (${env.nodeEnv})`);

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    // Disconnects all sockets, then closes the HTTP server.
    io.close(async () => {
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
