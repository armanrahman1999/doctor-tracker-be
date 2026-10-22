import { Router } from "express";
import { createDoctor, getDoctor, listDoctors } from "../controller/doctor.controller";

const router = Router();

router.post("/", createDoctor);
router.get("/", listDoctors);
router.get("/:id", getDoctor);

export default router;