import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";
import { Doctor } from "../models/Doctors";
import { Patient } from "../models/Patients";
import { sendSuccess } from "../utils/api";

const conditions = ["Stable", "Moderate", "Critical"] as const;
const growthQuerySchema = z.object({
  growthPeriod: z.enum(["7d", "30d", "90d", "6m", "1y", "all"]).default("6m"),
  growthInterval: z.enum(["day", "month", "year"]).default("month"),
});

type GrowthInterval = z.infer<typeof growthQuerySchema>["growthInterval"];

const floorToInterval = (date: Date, interval: GrowthInterval) => {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (interval === "month") result.setUTCDate(1);
  if (interval === "year") {
    result.setUTCMonth(0, 1);
  }
  return result;
};

const addInterval = (date: Date, interval: GrowthInterval) => {
  const result = new Date(date);
  if (interval === "day") result.setUTCDate(result.getUTCDate() + 1);
  if (interval === "month") result.setUTCMonth(result.getUTCMonth() + 1);
  if (interval === "year") result.setUTCFullYear(result.getUTCFullYear() + 1);
  return result;
};

const intervalFormat: Record<GrowthInterval, string> = {
  day: "%Y-%m-%d",
  month: "%Y-%m",
  year: "%Y",
};

const formatInterval = (date: Date, interval: GrowthInterval) => {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  if (interval === "year") return year;
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  if (interval === "month") return `${year}-${month}`;
  return `${year}-${month}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const getGrowthRange = (
  period: z.infer<typeof growthQuerySchema>["growthPeriod"],
  interval: GrowthInterval,
  now: Date,
  earliestPatientDate?: Date,
) => {
  const currentBucket = floorToInterval(now, interval);
  const currentDay = floorToInterval(now, "day");
  let start: Date;
  let end: Date;

  // Periods include the current UTC day; the query range is [start, end).
  if (period === "all") {
    start = earliestPatientDate ? floorToInterval(earliestPatientDate, interval) : currentBucket;
    end = addInterval(currentBucket, interval);
  } else if (period.endsWith("d")) {
    const days = Number(period.slice(0, -1));
    start = new Date(currentDay);
    start.setUTCDate(start.getUTCDate() - days + 1);
    end = addInterval(currentDay, "day");
  } else {
    const months = period === "6m" ? 6 : 12;
    start = new Date(Date.UTC(
      currentBucket.getUTCFullYear(),
      currentBucket.getUTCMonth() - months + 1,
      1,
    ));
    end = addInterval(currentDay, "day");
  }

  return { start, end, firstBucket: floorToInterval(start, interval) };
};

export const getStats = async (req: AuthRequest, res: Response) => {
  const parsed = growthQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid dashboard growth filters",
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  const { growthPeriod, growthInterval } = parsed.data;
  const now = new Date();
  const earliestPatient = growthPeriod === "all"
    ? await Patient.findOne().sort({ createdAt: 1 }).select({ createdAt: 1 }).lean()
    : null;
  const { start, end, firstBucket } = getGrowthRange(
    growthPeriod,
    growthInterval,
    now,
    earliestPatient?.createdAt,
  );

  const [totalDoctors, [aggregate]] = await Promise.all([
    Doctor.countDocuments(),
    Patient.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          critical: [{ $match: { condition: "Critical" } }, { $count: "count" }],
          conditions: [
            { $group: { _id: "$condition", count: { $sum: 1 } } },
            { $project: { _id: 0, condition: "$_id", count: 1 } },
          ],
          patientsPerDoctor: [
            { $group: { _id: "$doctorId", patientCount: { $sum: 1 } } },
            { $sort: { patientCount: -1, _id: 1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: Doctor.collection.name,
                localField: "_id",
                foreignField: "_id",
                as: "doctor",
              },
            },
            { $unwind: "$doctor" },
            { $project: { _id: 0, doctorName: "$doctor.name", patientCount: 1 } },
          ],
          patientGrowth: [
            { $match: { createdAt: { $gte: start, $lt: end } } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: intervalFormat[growthInterval],
                    date: "$createdAt",
                    timezone: "UTC",
                  },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: "$_id", count: 1 } },
          ],
        },
      },
    ]),
  ]);

  const totalPatients = aggregate?.total[0]?.count ?? 0;
  const conditionCounts = new Map<string, number>(
    (aggregate?.conditions ?? []).map((item: { condition: string; count: number }) =>
      [item.condition, item.count])
  );
  const growthCounts = new Map<string, number>(
    (aggregate?.patientGrowth ?? []).map((item: { date: string; count: number }) =>
      [item.date, item.count])
  );
  const patientGrowth: { date: string; count: number }[] = [];
  for (let date = new Date(firstBucket); date < end; date = addInterval(date, growthInterval)) {
    const key = formatInterval(date, growthInterval);
    patientGrowth.push({ date: key, count: growthCounts.get(key) ?? 0 });
  }

  return sendSuccess(res, "Dashboard retrieved successfully", {
    stats: {
      totalDoctors,
      totalPatients,
      criticalPatients: aggregate?.critical[0]?.count ?? 0,
      averagePatientsPerDoctor: totalDoctors ? Math.round(totalPatients / totalDoctors) : 0,
    },
    conditions: conditions.map((condition) => ({
      condition,
      count: conditionCounts.get(condition) ?? 0,
    })),
    patientsPerDoctor: aggregate?.patientsPerDoctor ?? [],
    patientGrowth,
  });
};
