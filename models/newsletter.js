import mongoose from "mongoose";

const newsleterSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    country: { type: String, required: true, default: "Unknown" },
    city: { type: String, required: true, default: "Unknown" },
  },
  {
    timestamps: true,
    collection: "newsletters",
  }
);

export const Newsletter =
  mongoose.models.Newsletter || mongoose.model("Newsletter", newsleterSchema);
