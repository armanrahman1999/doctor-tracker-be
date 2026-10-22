import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Doctor } from "../models/Doctors";
import { Patient } from "../models/Patients";
import { sendSuccess } from "../utils/api";

const conditions = ["Stable", "Moderate", "Critical"] as const;

export const getStats = async (_req: AuthRequest, res: Response) => {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);

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
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
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
  const growth = new Map<string, number>(
    (aggregate?.patientGrowth ?? []).map((item: { date: string; count: number }) =>
      [item.date, item.count])
  );
  const patientGrowth = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: growth.get(key) ?? 0 };
  });

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
