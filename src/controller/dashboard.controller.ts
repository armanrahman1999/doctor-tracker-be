import { Response } from "express";

import { AuthRequest } from "../middleware/auth";
import { Doctor } from "../models/Doctors";
import { Patient } from "../models/Patients";

export const getStats = async (req: AuthRequest, res: Response) => {
  // Date range for the "over time" chart. Default: last 30 days
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);

  const [totalDoctors, patientStats, specializations] = await Promise.all([
    Doctor.countDocuments(),

    // One round trip to MongoDB for all patient stats
    Patient.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],

          perDoctor: [
            { $group: { _id: "$doctorId", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: "doctors",
                localField: "_id",
                foreignField: "_id",
                as: "doctor",
              },
            },
            { $unwind: "$doctor" },
            { $project: { _id: 0, doctorId: "$_id", doctor: "$doctor.name", count: 1 } },
          ],

          overTime: [
            { $match: { admittedAt: { $gte: since } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$admittedAt" } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: "$_id", count: 1 } },
          ],

          byCondition: [
            { $group: { _id: "$condition", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, condition: "$_id", count: 1 } },
          ],

          byStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { _id: 0, status: "$_id", count: 1 } },
          ],
        },
      },
    ]),

    Doctor.aggregate([
      { $group: { _id: "$specialization", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, specialization: "$_id", count: 1 } },
    ]),
  ]);

  const stats = patientStats[0];

  res.json({
    totals: {
      doctors: totalDoctors,
      patients: stats.total[0]?.count ?? 0,
    },
    patientsPerDoctor: stats.perDoctor,
    patientsOverTime: fillMissingDays(stats.overTime, since, days),
    patientsByCondition: stats.byCondition,
    patientsByStatus: stats.byStatus,
    doctorsBySpecialization: specializations,
  });
};

// Charts look broken if days with zero patients are missing, so add them as 0
function fillMissingDays(
  rows: { date: string; count: number }[],
  start: Date,
  days: number
) {
  const map = new Map(rows.map((r) => [r.date, r.count]));
  const result: { date: string; count: number }[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: map.get(key) ?? 0 });
  }
  return result;
}