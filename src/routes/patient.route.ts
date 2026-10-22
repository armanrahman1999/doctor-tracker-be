import { Router } from "express";
import { listPatients, updatePatient, deletePatient } from "../controller/patient.controller";
const router = Router();

router.get("/", listPatients);
router.put("/:id", updatePatient);
router.delete("/:id", deletePatient);

export default router;