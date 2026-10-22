import { Router } from "express";
import { login, logout, me } from "../controller/auth.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;