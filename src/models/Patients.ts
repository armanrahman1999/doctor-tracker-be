import { Schema, Types, model } from "mongoose";

export type PatientCondition = "Stable" | "Moderate" | "Critical";

export interface PatientRecord {
  name: string;
  email: string;
  phone: string;
  condition: PatientCondition;
  doctorId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<PatientRecord>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    condition: { type: String, required: true, enum: ["Stable", "Moderate", "Critical"] },
    doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
  },
  { timestamps: true }
);

// Indexes for fast lists, filters, search and dashboard stats
patientSchema.index({ doctorId: 1, createdAt: -1 });
patientSchema.index({ doctorId: 1 });
patientSchema.index({ condition: 1 });
patientSchema.index({ createdAt: -1 });

export const Patient = model<PatientRecord>("Patient", patientSchema);