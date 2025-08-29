import mongoose from "mongoose";

const timestampSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "timestamp",
  }
);

export const Timestamp =
  mongoose.models.Timestamp || mongoose.model("Timestamp", timestampSchema);
