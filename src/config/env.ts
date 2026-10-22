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

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
}

const parseDurationSeconds = (name: string, value: string): number => {
  const durationMatch = /^(\d+)([smhd])$/.exec(value);
  if (!durationMatch) throw new Error(`${name} must be a duration such as 15m or 7d`);
  const unitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = Number(durationMatch[1]) * unitSeconds[durationMatch[2]!]!;
  if (!Number.isSafeInteger(seconds) || seconds < 1) {
    throw new Error(`${name} must be a positive duration`);
  }
  return seconds;
};

const accessTokenExpiresInSeconds = parseDurationSeconds(
  "ACCESS_TOKEN_EXPIRES_IN",
  process.env.ACCESS_TOKEN_EXPIRES_IN ?? "15m",
);
const refreshTokenExpiresInSeconds = parseDurationSeconds(
  "REFRESH_TOKEN_EXPIRES_IN",
  process.env.REFRESH_TOKEN_EXPIRES_IN ?? "30d",
);
const sameSite = process.env.COOKIE_SAME_SITE ?? (process.env.NODE_ENV === "production" ? "none" : "lax");
if (!["lax", "strict", "none"].includes(sameSite)) {
  throw new Error("COOKIE_SAME_SITE must be lax, strict, or none");
}

export const env = {
  port,
  trustProxyHops,
  mongoUri: required("MONGODB_URI", "MONGO_URI"),
  jwtSecret: required("JWT_SECRET"),
  accessTokenExpiresInSeconds,
  refreshTokenExpiresInSeconds,
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
  isProd: process.env.NODE_ENV === "production",
  cookieDomain: process.env.COOKIE_DOMAIN?.trim() || undefined,
  cookieSameSite: sameSite as "lax" | "strict" | "none",
  cookieSecure: process.env.NODE_ENV === "production" || sameSite === "none",
};
