import mongoose from "mongoose";

const newsleterSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: "newsletters",
  }
);

export const Newsletter =
  mongoose.models.Newsletter || mongoose.model("Newsletter", newsleterSchema);
