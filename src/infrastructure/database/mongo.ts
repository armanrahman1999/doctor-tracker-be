import dns from "node:dns";
import mongoose from "mongoose";

export const connectMongo = async (uri: string) => {
  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
  mongoose.connection.on("error", (err) => console.error("MongoDB error:", err.message));

  if (uri.startsWith("mongodb+srv://")) {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connected (db: ${mongoose.connection.name})`);
};

export const disconnectMongo = () => mongoose.disconnect();