import { CookieOptions, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { User } from "../models/User";
import { AuthRequest } from "../middleware/auth";
import { sendSuccess, sendValidationError } from "../utils/api";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? "none" : "lax",
  path: "/",
};

export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const email = parsed.data.email.toLowerCase();
  const user = await User.findOne({ email }).select("+password");
  const valid = user && await bcrypt.compare(parsed.data.password, user.password);
  if (!user || !valid) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresInSeconds }
  );

  res.cookie(env.cookieName, token, {
    ...cookieOptions,
    maxAge: env.jwtExpiresInSeconds * 1000,
  });
  return sendSuccess(res, "Login successful", {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie(env.cookieName, cookieOptions);
  return sendSuccess(res, "Logout successful", null);
};

export const me = async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) {
    return res.status(401).json({ success: false, message: "User no longer exists" });
  }

  return sendSuccess(res, "User retrieved successfully", {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
};
