import { Schema, Types, model } from "mongoose";

export interface DoctorRecord {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<DoctorRecord>(
  {
    name: { type: String, required: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    hospital: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Indexes for fast filtering, sorting and searching
doctorSchema.index({ createdAt: -1 });
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ hospital: 1 });

export const Doctor = model<DoctorRecord>("Doctor", doctorSchema);