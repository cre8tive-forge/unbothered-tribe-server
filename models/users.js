import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    firstname: { type: String, required: true, unique: false },
    lastname: { type: String, required: false, unique: false },
    number: { type: String, required: false, unique: false },
    country: { type: String, required: false, unique: false },
    type: { type: String, required: true, unique: false },
    password: { type: String, required: false },
    profilePhoto: { type: String, required: false },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
