import { Response } from "express";
import { z } from "zod";

import { AuthRequest } from "../middleware/auth";
import { Doctor } from "../models/Doctors";

const createSchema = z.object({
  name: z.string().trim().min(2),
  specialization: z.string().trim().min(2),
  hospital: z.string().trim().min(2),
  phone: z.string().trim().min(5),
  email: z.string().trim().toLowerCase().email(),
});

export const createDoctor = async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
  }

  try {
    const doctor = await Doctor.create({ ...parsed.data, createdBy: req.user!.id });
    res.status(201).json(doctor);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      return res.status(409).json({ error: "A doctor with this email already exists" });
    }
    throw e;
  }
};

export const listDoctors = async (req: AuthRequest, res: Response) => {
  const { search, specialization, hospital, from, to } = req.query as Record<string, string>;

  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);

  // Build the filter only from what was provided
  const filter: Record<string, any> = {};

  if (search) filter.$text = { $search: search };
  if (specialization) filter.specialization = new RegExp(`^${escapeRegex(specialization)}$`, "i");
  if (hospital) filter.hospital = new RegExp(escapeRegex(hospital), "i");

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999); // include the whole "to" day
      filter.createdAt.$lte = end;
    }
  }

  // Run the list query and the count at the same time
  const [data, total] = await Promise.all([
    Doctor.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Doctor.countDocuments(filter),
  ]);

  res.json({
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};

export const getDoctor = async (req: AuthRequest, res: Response) => {
  const doctor = await Doctor.findById(req.params.id).lean();
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  res.json(doctor);
};

// Stops users from breaking the regex with characters like ( or *
function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}