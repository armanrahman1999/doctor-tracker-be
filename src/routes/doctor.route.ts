import { Router } from "express";
import {
  createDoctor, deleteDoctor, getDoctor, listDoctors, updateDoctor,
} from "../controller/doctor.controller";
import {
  addPatientToDoctor, listDoctorPatients, removePatientFromDoctor,
} from "../controller/patient.controller";

const router = Router();

router.post("/", createDoctor);
router.get("/", listDoctors);
router.get("/:doctorId", getDoctor);
router.patch("/:doctorId", updateDoctor);
router.delete("/:doctorId", deleteDoctor);

router.get("/:doctorId/patients", listDoctorPatients);
router.post("/:doctorId/patients", addPatientToDoctor);
router.delete("/:doctorId/patients/:patientId", removePatientFromDoctor);

export default router;