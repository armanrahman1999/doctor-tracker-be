import { Router } from "express";
import { login, logout, me, refresh } from "../controller/auth.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;