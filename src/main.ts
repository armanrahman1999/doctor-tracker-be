import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { connectMongo, disconnectMongo } from "./infrastructure/database/mongo";
import authRoutes from "./routes/auth.routes";
import { authenticate , authorize } from "./middleware/auth";
import doctorRoutes from "./routes/doctor.route";
import patientRoutes from "./routes/patient.route";
import dashboardRoutes from "./routes/dashboard.route";


const bootstrap = async () => {
  await connectMongo(env.mongoUri);

  const app = express();
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/doctors", authenticate, doctorRoutes);
  app.use("/api/patients", authenticate, patientRoutes);  
app.use("/api/dashboard", authenticate, authorize("admin"), dashboardRoutes);
  // Catches any unexpected error so the server doesn't crash
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

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