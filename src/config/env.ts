import "dotenv/config";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

export const env = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: required("MONGO_URI"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresInSeconds: 60 * 60 * 24, // 1 day
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  isProd: process.env.NODE_ENV === "production",
  cookieName: "token",
}