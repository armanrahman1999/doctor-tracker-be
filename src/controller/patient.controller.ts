import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";
import { Doctor } from "../models/Doctors";
import { Patient } from "../models/Patients";
import { NotFoundError } from "../shared/AppError";
import { escapeRegex, getPagination, sendSuccess, sendValidationError, toDateRange } from "../utils/api";

const patientFields = {
  doctorId: z.string().refine(isValidObjectId, "Invalid doctor id"),
  name: z.string().trim().min(2),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  phone: z.string().trim().min(5),
  condition: z.enum(["Stable", "Moderate", "Critical"]),
};

const createSchema = z.object(patientFields);
const updateSchema = z.object(patientFields).partial()
  .refine((data) => Object.keys(data).length > 0, "At least one field is required");
const dateQuery = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");
const listSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  doctorId: z.string().refine(isValidObjectId, "Invalid doctor id").optional(),
  condition: z.enum(["Stable", "Moderate", "Critical"]).optional(),
  from: dateQuery.optional(),
  to: dateQuery.optional(),
  sortBy: z.enum(["name", "email", "condition", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
}).refine((query) => !query.from || !query.to || new Date(query.from) <= new Date(query.to), {
  message: "from must be before or equal to to",
  path: ["from"],
});

const toPatientDto = (patient: {
  _id: unknown;
  doctorId: unknown;
  name: string;
  email: string;
  phone: string;
  condition: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: String(patient._id),
  doctorId: String(patient.doctorId),
  name: patient.name,
  email: patient.email,
  phone: patient.phone,
  condition: patient.condition,
  createdAt: patient.createdAt.toISOString(),
  updatedAt: patient.updatedAt.toISOString(),
});

const listForDoctor = async (req: AuthRequest, res: Response, doctorId?: string) => {
  const parsed = listSchema.safeParse({
    ...req.query,
    ...(doctorId ? { doctorId } : {}),
  });
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const query = parsed.data;
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const filter: Record<string, unknown> = {};
  if (query.doctorId) filter.doctorId = query.doctorId;
  if (query.condition) filter.condition = query.condition;
  if (query.search) {
    const search = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ name: search }, { email: search }, { phone: search }];
  }
  const createdAt = toDateRange(query.from, query.to);
  if (createdAt) filter.createdAt = createdAt;
  const sortBy = query.sortBy ?? "createdAt";
  const direction = query.sortOrder === "asc" ? 1 : -1;

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .sort({ [sortBy]: direction, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Patient.countDocuments(filter),
  ]);
  return sendSuccess(res, doctorId ? "Doctor patients retrieved successfully" : "Patients retrieved successfully", {
    data: patients.map(toPatientDto),
    pagination: getPagination(page, limit, total),
  });
};

export const listPatients = (req: AuthRequest, res: Response) => listForDoctor(req, res);

export const getPatient = async (req: AuthRequest, res: Response) => {
  const { patientId } = req.params;
  if (!isValidObjectId(patientId)) {
    return res.status(400).json({ success: false, message: "Invalid patient id" });
  }
  const patient = await Patient.findById(patientId).lean();
  if (!patient) throw new NotFoundError("Patient not found");
  return sendSuccess(res, "Patient retrieved successfully", toPatientDto(patient));
};

const createPatient = async (doctorId: string, req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse({ ...req.body, doctorId: doctorId || req.body?.doctorId });
  if (!parsed.success) return sendValidationError(res, parsed.error);
  if (!await Doctor.exists({ _id: parsed.data.doctorId })) {
    throw new NotFoundError("Doctor not found");
  }

  const patient = await Patient.create(parsed.data);
  return sendSuccess(res, "Patient created successfully", toPatientDto(patient), 201);
};

export const addPatient = (req: AuthRequest, res: Response) => createPatient("", req, res);

export const addPatientToDoctor = (req: AuthRequest, res: Response) => {
  const { doctorId } = req.params;
  if (typeof doctorId !== "string" || !isValidObjectId(doctorId)) {
    return res.status(400).json({ success: false, message: "Invalid doctor id" });
  }
  return createPatient(doctorId, req, res);
};

export const updatePatient = async (req: AuthRequest, res: Response) => {
  const { patientId } = req.params;
  if (typeof patientId !== "string" || !isValidObjectId(patientId)) {
    return res.status(400).json({ success: false, message: "Invalid patient id" });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  if (parsed.data.doctorId && !await Doctor.exists({ _id: parsed.data.doctorId })) {
    throw new NotFoundError("Doctor not found");
  }

  const patient = await Patient.findByIdAndUpdate(patientId, parsed.data, {
    new: true,
    runValidators: true,
  }).lean();
  if (!patient) throw new NotFoundError("Patient not found");
  return sendSuccess(res, "Patient updated successfully", toPatientDto(patient));
};

export const deletePatient = async (req: AuthRequest, res: Response) => {
  const { patientId } = req.params;
  if (typeof patientId !== "string" || !isValidObjectId(patientId)) {
    return res.status(400).json({ success: false, message: "Invalid patient id" });
  }
  const patient = await Patient.findByIdAndDelete(patientId);
  if (!patient) throw new NotFoundError("Patient not found");
  return sendSuccess(res, "Patient deleted successfully", null);
};

export const listDoctorPatients = async (req: AuthRequest, res: Response) => {
  const { doctorId } = req.params;
  if (typeof doctorId !== "string" || !isValidObjectId(doctorId)) {
    return res.status(400).json({ success: false, message: "Invalid doctor id" });
  }
  if (!await Doctor.exists({ _id: doctorId })) throw new NotFoundError("Doctor not found");
  return listForDoctor(req, res, doctorId);
};

export const removePatientFromDoctor = async (req: AuthRequest, res: Response) => {
  const { doctorId, patientId } = req.params;
  if (typeof doctorId !== "string" || typeof patientId !== "string" ||
    !isValidObjectId(doctorId) || !isValidObjectId(patientId)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const patient = await Patient.findOneAndDelete({ _id: patientId, doctorId });
  if (!patient) throw new NotFoundError("Patient not found for this doctor");
  return sendSuccess(res, "Patient deleted successfully", null);
};
