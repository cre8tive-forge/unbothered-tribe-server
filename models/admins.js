import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: "admins",
  }
);

export const Admin =
  mongoose.models.Admin || mongoose.model("Admin", adminSchema);
