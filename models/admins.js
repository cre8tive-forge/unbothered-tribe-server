import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    fullname: { type: String, required: false, unique: false },
    password: { type: String, required: false },
    profilePhoto: { type: String, required: false },
  },
  {
    timestamps: true,
    collection: "admins",
  }
);

export const Admin =
  mongoose.models.Admin || mongoose.model("Admin", adminSchema);
