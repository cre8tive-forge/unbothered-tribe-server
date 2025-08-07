import mongoose from "mongoose";

const loginSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    password: { type: String, required: true },
    type: { type: String, required: true },
    country: { type: String },
  },
  {
    timestamps: true,
    collection: "logins",
  }
);

export const Logins = mongoose.models.Logins || mongoose.model("Logins", loginSchema);
