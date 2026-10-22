import { randomBytes, createHash } from "node:crypto";
import { CookieOptions, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { User } from "../models/User";
import { RefreshSession } from "../models/RefreshSession";
import { AuthRequest } from "../middleware/auth";
import { sendSuccess, sendValidationError } from "../utils/api";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: "/",
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
};

const hashRefreshToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const createAccessToken = (user: { id: string; role: string }) =>
  jwt.sign({ id: user.id, role: user.role, tokenType: "access" }, env.jwtSecret, {
    expiresIn: env.accessTokenExpiresInSeconds,
  });

const createRefreshToken = async (userId: string) => {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.refreshTokenExpiresInSeconds * 1000);
  await RefreshSession.create({
    userId,
    tokenHash: hashRefreshToken(token),
    expiresAt,
  });
  return token;
};

const setAuthCookies = (res: Response, user: { id: string; role: string }, refreshToken: string) => {
  res.cookie("access_token", createAccessToken(user), {
    ...cookieOptions,
    maxAge: env.accessTokenExpiresInSeconds * 1000,
  });
  res.cookie("refresh_token", refreshToken, {
    ...cookieOptions,
    maxAge: env.refreshTokenExpiresInSeconds * 1000,
  });
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie("access_token", cookieOptions);
  res.clearCookie("refresh_token", cookieOptions);
};

const userDto = (user: { id: string; name: string; email: string; role: string }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const unauthorized = (res: Response) =>
  res.status(401).json({ success: false, message: "Invalid or expired refresh token" });

export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const email = parsed.data.email.toLowerCase();
  const user = await User.findOne({ email }).select("+password");
  const valid = user && await bcrypt.compare(parsed.data.password, user.password);
  if (!user || !valid) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  const refreshToken = await createRefreshToken(user.id);
  setAuthCookies(res, { id: user.id, role: user.role }, refreshToken);
  return sendSuccess(res, "Login successful", userDto(user));
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;
  if (typeof refreshToken !== "string" || refreshToken.length === 0) return unauthorized(res);

  const session = await RefreshSession.findOneAndDelete({
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: { $gt: new Date() },
  });
  if (!session) {
    clearAuthCookies(res);
    return unauthorized(res);
  }

  const user = await User.findById(session.userId);
  if (!user) {
    clearAuthCookies(res);
    return unauthorized(res);
  }

  const newRefreshToken = await createRefreshToken(user.id);
  setAuthCookies(res, { id: user.id, role: user.role }, newRefreshToken);
  return sendSuccess(res, "Token refreshed successfully", null);
};

export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;
  if (typeof refreshToken === "string" && refreshToken.length > 0) {
    await RefreshSession.deleteOne({ tokenHash: hashRefreshToken(refreshToken) });
  }
  clearAuthCookies(res);
  return sendSuccess(res, "Logout successful", null);
};

export const me = async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) {
    clearAuthCookies(res);
    return res.status(401).json({ success: false, message: "User no longer exists" });
  }

  return sendSuccess(res, "User retrieved successfully", userDto(user));
};
