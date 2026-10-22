import { Response } from "express";
import { isValidObjectId, PipelineStage, Types } from "mongoose";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";
import { Doctor } from "../models/Doctors";
import { Patient } from "../models/Patients";
import { ConflictError, NotFoundError } from "../shared/AppError";
import { escapeRegex, getPagination, sendSuccess, sendValidationError, toDateRange } from "../utils/api";

const doctorFields = {
  name: z.string().trim().min(2),
  specialization: z.string().trim().min(2),
  hospital: z.string().trim().min(2),
  phone: z.string().trim().min(5),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
};

const createSchema = z.object(doctorFields);
const updateSchema = z.object(doctorFields).partial().refine((data) => Object.keys(data).length > 0);
const dateQuery = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");
const listSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  specialization: z.string().optional(),
  hospital: z.string().optional(),
  from: dateQuery.optional(),
  to: dateQuery.optional(),
  sortBy: z.enum(["name", "specialization", "hospital", "patientCount", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
}).refine((query) => !query.from || !query.to || new Date(query.from) <= new Date(query.to), {
  message: "from must be before or equal to to",
  path: ["from"],
});

const doctorProject = {
  _id: 0,
  id: { $toString: "$_id" },
  name: 1,
  specialization: 1,
  hospital: 1,
  phone: 1,
  email: 1,
  patientCount: 1,
  createdAt: 1,
  updatedAt: 1,
};

export const createDoctor = async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  let doctor;
  try {
    doctor = await Doctor.create({ ...parsed.data, createdBy: req.user!.id });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new ConflictError("A doctor with this email already exists");
    }
    throw error;
  }
  return sendSuccess(res, "Doctor created successfully", {
    id: doctor.id,
    name: doctor.name,
    specialization: doctor.specialization,
    hospital: doctor.hospital,
    phone: doctor.phone,
    email: doctor.email,
    patientCount: 0,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  }, 201);
};

export const listDoctors = async (req: AuthRequest, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const query = parsed.data;
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const filter: PipelineStage.Match["$match"] = {};
  if (query.search) {
    const search = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [
      { name: search }, { email: search }, { phone: search },
      { hospital: search }, { specialization: search },
    ];
  }
  if (query.specialization) filter.specialization = new RegExp(`^${escapeRegex(query.specialization)}$`, "i");
  if (query.hospital) filter.hospital = new RegExp(escapeRegex(query.hospital), "i");
  const createdAt = toDateRange(query.from, query.to);
  if (createdAt) filter.createdAt = createdAt;

  const direction = query.sortOrder === "asc" ? 1 : -1;
  const sortBy = query.sortBy ?? "createdAt";
  const pipeline: PipelineStage[] = [{ $match: filter }];
  const countLookup: PipelineStage.Lookup = {
    $lookup: {
      from: Patient.collection.name,
      let: { doctorId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$doctorId", "$$doctorId"] } } },
        { $count: "count" },
      ],
      as: "patientCountResult",
    },
  };
  const addPatientCount: PipelineStage.AddFields = {
    $addFields: {
      patientCount: { $ifNull: [{ $arrayElemAt: ["$patientCountResult.count", 0] }, 0] },
    },
  };

  if (sortBy === "patientCount") {
    pipeline.push(countLookup, addPatientCount, { $sort: { patientCount: direction, _id: 1 } });
    pipeline.push({
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: doctorProject },
        ],
        total: [{ $count: "count" }],
      },
    });
  } else {
    pipeline.push({
      $facet: {
        data: [
          { $sort: { [sortBy]: direction, _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          countLookup,
          addPatientCount,
          { $project: doctorProject },
        ],
        total: [{ $count: "count" }],
      },
    });
  }

  const [result] = await Doctor.aggregate(pipeline);
  const data = result?.data ?? [];
  const total = result?.total[0]?.count ?? 0;
  return sendSuccess(res, "Doctors retrieved successfully", {
    data,
    pagination: getPagination(page, limit, total),
  });
};

export const getDoctor = async (req: AuthRequest, res: Response) => {
  const { doctorId } = req.params;
  if (typeof doctorId !== "string" || !isValidObjectId(doctorId)) {
    return res.status(400).json({ success: false, message: "Invalid doctor id" });
  }

  const [doctor, patientCount] = await Promise.all([
    Doctor.findById(doctorId).lean(),
    Patient.collection.countDocuments({ doctorId: new Types.ObjectId(doctorId) }),
  ]);
  if (!doctor) throw new NotFoundError("Doctor not found");

  return sendSuccess(res, "Doctor retrieved successfully", {
    id: String(doctor._id),
    name: doctor.name,
    specialization: doctor.specialization,
    hospital: doctor.hospital,
    phone: doctor.phone,
    email: doctor.email,
    patientCount,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  });
};

export const updateDoctor = async (req: AuthRequest, res: Response) => {
  const { doctorId } = req.params;
  if (typeof doctorId !== "string" || !isValidObjectId(doctorId)) {
    return res.status(400).json({ success: false, message: "Invalid doctor id" });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  let doctor;
  try {
    doctor = await Doctor.findByIdAndUpdate(doctorId, parsed.data, {
      new: true,
      runValidators: true,
    }).lean();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new ConflictError("A doctor with this email already exists");
    }
    throw error;
  }
  if (!doctor) throw new NotFoundError("Doctor not found");
  const patientCount = await Patient.collection.countDocuments({
    doctorId: new Types.ObjectId(doctorId),
  });

  return sendSuccess(res, "Doctor updated successfully", {
    id: String(doctor._id),
    name: doctor.name,
    specialization: doctor.specialization,
    hospital: doctor.hospital,
    phone: doctor.phone,
    email: doctor.email,
    patientCount,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  });
};

export const deleteDoctor = async (req: AuthRequest, res: Response) => {
  const { doctorId } = req.params;
  if (typeof doctorId !== "string" || !isValidObjectId(doctorId)) {
    return res.status(400).json({ success: false, message: "Invalid doctor id" });
  }
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new NotFoundError("Doctor not found");
  if (await Patient.collection.findOne({
    doctorId: new Types.ObjectId(doctorId),
  }, { projection: { _id: 1 } })) {
    throw new ConflictError("Doctor cannot be deleted while patients are assigned");
  }
  await doctor.deleteOne();
  return sendSuccess(res, "Doctor deleted successfully", null);
};
