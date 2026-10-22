import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env";
import { connectMongo, disconnectMongo } from "./infrastructure/database/mongo";
import authRoutes from "./routes/auth.routes";
import { authenticate, authorize } from "./middleware/auth";
import doctorRoutes from "./routes/doctor.route";
import patientRoutes from "./routes/patient.route";
import dashboardRoutes from "./routes/dashboard.route";
import { errorHandler } from "./middleware/error";
import { sendSuccess } from "./utils/api";

const bootstrap = async () => {
  await connectMongo(env.mongoUri);

  const app = express();
  if (env.trustProxyHops > 0) app.set("trust proxy", env.trustProxyHops);
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/v1/health", (_req, res) => sendSuccess(res, "API is healthy", { status: "ok" }));
  app.use("/api/v1", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please try again later." },
  }));
  app.use("/api/v1/auth/login", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many login attempts. Please try again later." },
  }));
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/doctors", authenticate, doctorRoutes);
  app.use("/api/v1/patients", authenticate, patientRoutes);
  app.use("/api/v1/dashboard", authenticate, authorize("admin"), dashboardRoutes);
  app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found" }));
  app.use(errorHandler);

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

bootstrap().catch((err: unknown) => {
  console.error("Failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});