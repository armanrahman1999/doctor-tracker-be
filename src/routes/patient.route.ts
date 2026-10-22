import { Router } from "express";
import {
  addPatient, deletePatient, getPatient, listPatients, updatePatient,
} from "../controller/patient.controller";
const router = Router();

router.get("/", listPatients);
router.post("/", addPatient);
router.get("/:patientId", getPatient);
router.patch("/:patientId", updatePatient);
router.put("/:patientId", updatePatient);
router.delete("/:patientId", deletePatient);

export default router;