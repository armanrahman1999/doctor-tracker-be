import { env } from "../config/env";
import { connectMongo, disconnectMongo } from "../infrastructure/database/mongo";
import { Patient } from "../models/Patients";
import { Doctor } from "../models/Doctors";

const specs = ["Cardiology", "Neurology", "Orthopedics", "Pediatrics", "Dermatology"];
const hospitals = ["Square Hospital", "United Hospital", "Evercare", "Labaid"];
const conditions = ["Diabetes", "Hypertension", "Fracture", "Asthma", "Migraine", "Fever"];
const statuses = ["active", "active", "active", "recovered", "critical"];
const genders = ["male", "female", "other"];
const pick = <T,>(arr: T[]): T => {
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

  const counts = new Map<string, number>();
  const patients = Array.from({ length: 150 }, (_, i) => {
    const doctor = pick(doctors);
    counts.set(doctor.id, (counts.get(doctor.id) ?? 0) + 1);
    const daysAgo = Math.floor(Math.random() * 30);
    return {
      name: `Patient ${i + 1}`,
      age: 5 + Math.floor(Math.random() * 80),
      gender: pick(genders),
      condition: pick(conditions),
      status: pick(statuses),
      doctorId: doctor._id,
      admittedAt: new Date(Date.now() - daysAgo * 86400000),
    };
  });
  await Patient.insertMany(patients);

  // Keep the denormalized counter correct
  for (const [id, count] of counts) {
    await Doctor.findByIdAndUpdate(id, { patientCount: count });
  }

  console.log("Demo data created: 12 doctors, 150 patients");
  await disconnectMongo();
};

run().catch((e) => { console.error(e.message); process.exit(1); });