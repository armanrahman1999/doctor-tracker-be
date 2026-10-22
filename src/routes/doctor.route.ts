import { Router } from "express";
import { createDoctor, getDoctor, listDoctors } from "../controller/doctor.controller";
import { addPatientToDoctor, listDoctorPatients, removePatientFromDoctor } from "../controller/patient.controller";

const router = Router();

router.post("/", createDoctor);
router.get("/", listDoctors);
router.get("/:id", getDoctor);

router.get("/:id/patients", listDoctorPatients);
router.post("/:id/patients", addPatientToDoctor);
router.delete("/:id/patients/:patientId", removePatientFromDoctor);

export default router;