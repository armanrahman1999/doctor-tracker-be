import express from "express";
import { env } from "./config/env";
import { connectMongo, disconnectMongo } from "./infrastructure/database/mongo";

const bootstrap = async () => {
  await connectMongo(env.mongoUri);

  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  const server = app.listen(env.port, () =>
    console.log(`Server running on http://localhost:${env.port}`)
  );

  const shutdown = async () => {
    server.close();
    await disconnectMongo();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

bootstrap().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});