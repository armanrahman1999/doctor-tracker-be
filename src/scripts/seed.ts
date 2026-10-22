import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { connectMongo, disconnectMongo } from "../infrastructure/database/mongo";
import { User } from "../models/User";

const run = async () => {
  await connectMongo(env.mongoUri);

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const plainPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!plainPassword || plainPassword.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be set and at least 8 characters");
  }

  const exists = await User.findOne({ email });
  if (exists) {
    console.log("Admin already exists, skipping.");
  } else {
    await User.create({
      name: process.env.SEED_ADMIN_NAME ?? "Admin",
      email,
      password: await bcrypt.hash(plainPassword, 10),
      role: "admin",
    });
    console.log("Admin created:", email);
  }

  await disconnectMongo();
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});