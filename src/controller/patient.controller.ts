import { Response } from "express";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";

import { AuthRequest } from "../middleware/auth";
import { buildPatientFilter, parsePaging } from "../utils/patientQuery";
import { Patient } from "../models/Patients";
import { Doctor } from "../models/Doctors";

const patientSchema = z.object({
  name: z.string().trim().min(2),
  age: z.number().int().min(0).max(130).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  condition: z.string().trim().min(2),
  status: z.enum(["active", "recovered", "critical"]).optional(),
  admittedAt: z.coerce.date().optional(),
});

const updateSchema = patientSchema.partial();

const paged = (data: unknown[], total: number, page: number, limit: number) => ({
  data,
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
});

// ---------- Patients page ----------

export const listPatients = async (req: AuthRequest, res: Response) => {
  const { page, limit } = parsePaging(req.query);
  const filter = buildPatientFilter(req.query);

  const [data, total] = await Promise.all([
    Patient.find(filter)
      .populate("doctorId", "name specialization") // show the doctor's name in the table
      .sort({ admittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Patient.countDocuments(filter),
  ]);

  res.json(paged(data, total, page, limit));
};

export const updatePatient = async (req: AuthRequest, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid patient id" });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
  }

  const patient = await Patient.findByIdAndUpdate(req.params.id, parsed.data, {
    new: true,
    runValidators: true,
  }).lean();

  if (!patient) return res.status(404).json({ error: "Patient not found" });
  res.json(patient);
};

export const deletePatient = async (req: AuthRequest, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid patient id" });
  }

  const patient = await Patient.findByIdAndDelete(req.params.id);
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  await Doctor.findByIdAndUpdate(patient.doctorId, { $inc: { patientCount: -1 } });
  res.status(204).send();
};

// ---------- Under a doctor ----------

export const listDoctorPatients = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (typeof id !== "string" || !isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid doctor id" });
  }
  const doctorId = new Types.ObjectId(id);

  const doctorExists = await Doctor.exists({ _id: doctorId });
  if (!doctorExists) return res.status(404).json({ error: "Doctor not found" });

  const { page, limit } = parsePaging(req.query);
  const filter = { ...buildPatientFilter(req.query), doctorId };

  const [data, total] = await Promise.all([
    Patient.find(filter)
      .sort({ admittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Patient.countDocuments(filter),
  ]);

  res.json(paged(data, total, page, limit));
};

export const addPatientToDoctor = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return res.status(400).json({ error: "Invalid doctor id" });

  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
  }

  const doctor = await Doctor.findById(id);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });

  const patient = await Patient.create({
    name: parsed.data.name,
    condition: parsed.data.condition,
    doctorId: doctor._id,
    ...(parsed.data.age !== undefined ? { age: parsed.data.age } : {}),
    ...(parsed.data.gender !== undefined ? { gender: parsed.data.gender } : {}),
    ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
    ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.admittedAt !== undefined ? { admittedAt: parsed.data.admittedAt } : {}),
  });
  await Doctor.findByIdAndUpdate(doctor._id, { $inc: { patientCount: 1 } });

  res.status(201).json(patient);
};

export const removePatientFromDoctor = async (req: AuthRequest, res: Response) => {
  const { id, patientId } = req.params;
  if (
    typeof id !== "string" ||
    typeof patientId !== "string" ||
    !isValidObjectId(id) ||
    !isValidObjectId(patientId)
  ) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const doctorId = new Types.ObjectId(id);
  const patientObjectId = new Types.ObjectId(patientId);

  // Match both ids so you can't delete a patient through the wrong doctor
  const patient = await Patient.findOneAndDelete({ _id: patientObjectId, doctorId });
  if (!patient) return res.status(404).json({ error: "Patient not found for this doctor" });

  await Doctor.findByIdAndUpdate(doctorId, { $inc: { patientCount: -1 } });
  res.status(204).send();
};