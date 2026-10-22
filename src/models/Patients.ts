import { Schema, model } from "mongoose";

const patientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    age: { type: Number, min: 0, max: 130 },
    gender: { type: String, enum: ["male", "female", "other"] },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    condition: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "recovered", "critical"], default: "active" },
    doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
    admittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes for fast lists, filters, search and dashboard stats
patientSchema.index({ doctorId: 1, createdAt: -1 });
patientSchema.index({ condition: 1, status: 1 });
patientSchema.index({ admittedAt: -1 });
patientSchema.index({ name: "text", condition: "text" });

export const Patient = model("Patient", patientSchema);