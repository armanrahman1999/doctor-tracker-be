import { Schema, model } from "mongoose";

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    hospital: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    patientCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Indexes for fast filtering, sorting and searching
doctorSchema.index({ createdAt: -1 });
doctorSchema.index({ specialization: 1, hospital: 1 });
doctorSchema.index({ name: "text", specialization: "text", hospital: "text" });

export const Doctor = model("Doctor", doctorSchema);