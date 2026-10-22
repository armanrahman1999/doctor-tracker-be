import { env } from "../config/env";
import { connectMongo, disconnectMongo } from "../infrastructure/database/mongo";
import { Patient } from "../models/Patients";
import { Doctor } from "../models/Doctors";

const specs = ["Cardiology", "Neurology", "Orthopedics", "Pediatrics", "Dermatology"];
const hospitals = ["Square Hospital", "United Hospital", "Evercare", "Labaid"];
const conditions = ["Stable", "Moderate", "Critical"] as const;
const pick = <T,>(arr: readonly T[]): T => {
  const value = arr[Math.floor(Math.random() * arr.length)];
  if (value === undefined) throw new Error("Cannot pick from an empty array");
  return value;
};

const run = async () => {
  await connectMongo(env.mongoUri);

  await Patient.deleteMany({});
  await Doctor.deleteMany({});

  const doctors = await Doctor.insertMany(
    Array.from({ length: 12 }, (_, i) => ({
      name: `Dr. Demo ${i + 1}`,
      specialization: pick(specs),
      hospital: pick(hospitals),
      phone: `0171000${String(i).padStart(4, "0")}`,
      email: `demo${i + 1}@example.com`,
    }))
  );

  const patients = Array.from({ length: 150 }, (_, i) => {
    const doctor = pick(doctors);
    return {
      name: `Patient ${i + 1}`,
      email: `patient${i + 1}@example.com`,
      phone: `+1 403 555 ${String(1000 + i).padStart(4, "0")}`,
      condition: pick(conditions),
      doctorId: doctor._id,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000),
    };
  });
  await Patient.insertMany(patients);

  console.log("Demo data created: 12 doctors, 150 patients");
  await disconnectMongo();
};

run().catch((e) => { console.error(e.message); process.exit(1); });