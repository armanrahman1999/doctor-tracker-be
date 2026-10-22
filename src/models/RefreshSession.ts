import { Schema, Types, model } from "mongoose";

interface RefreshSessionRecord {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
}

const refreshSessionSchema = new Schema<RefreshSessionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export const RefreshSession = model<RefreshSessionRecord>("RefreshSession", refreshSessionSchema);
