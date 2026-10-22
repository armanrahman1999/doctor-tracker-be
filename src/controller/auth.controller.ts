import { Request, Response, CookieOptions } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models/User";
import { AuthRequest } from "../middleware/auth";

const cookieOptions: CookieOptions = {
  httpOnly: true,       // JavaScript can't read it (protects against XSS)
  secure: env.isProd,   // HTTPS only in production
  sameSite: "lax",
  path: "/",
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // password has select:false in the model, so we ask for it explicitly
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

  // Same message for "no such email" and "wrong password"
  const valid = user && (await bcrypt.compare(password, user.password));
  if (!user || !valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresInSeconds,
  });

  res.cookie(env.cookieName, token, {
    ...cookieOptions,
    maxAge: env.jwtExpiresInSeconds * 1000,
  });

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie(env.cookieName, cookieOptions);
  res.status(204).send();
};

export const me = async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) return res.status(401).json({ error: "User no longer exists" });

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
};