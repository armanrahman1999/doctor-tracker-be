import { Router } from "express";
import { getStats } from "../controller/dashboard.controller";
const router = Router();

router.get("/", getStats);

export default router;