import "dotenv/config";

const required = (name: string, fallbackName?: string): string => {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

const port = Number(process.env.PORT ?? 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port");
}

const jwtExpiry = process.env.JWT_EXPIRES_IN ?? "7d";
const jwtExpiryMatch = /^(\d+)([smhd])$/.exec(jwtExpiry);
if (!jwtExpiryMatch) throw new Error("JWT_EXPIRES_IN must be a duration such as 30m or 7d");
const unitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
const jwtExpiresInSeconds = Number(jwtExpiryMatch[1]) * unitSeconds[jwtExpiryMatch[2]!]!;
if (!Number.isSafeInteger(jwtExpiresInSeconds) || jwtExpiresInSeconds < 1) {
  throw new Error("JWT_EXPIRES_IN must be a positive duration");
}

export const env = {
  port,
  mongoUri: required("MONGODB_URI", "MONGO_URI"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresInSeconds,
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
  isProd: process.env.NODE_ENV === "production",
  cookieName: process.env.COOKIE_NAME ?? "doctor_tracker_session",
};
