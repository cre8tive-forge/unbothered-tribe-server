import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    firstname: { type: String, required: true, trim: true },
    lastname: { type: String, trim: true },
    country: { type: String, trim: true, default: "Nigeria" },
    status: {
      type: String,
      enum: ["active", "suspended", "banned"],
      default: "active",
    },
    role: {
      type: String,
      required: true,
      enum: ["User", "Admin"],
      default: "User",
    },

    address: {
      firstname: { type: String, required: true, trim: true },
      lastname: { type: String, trim: true },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      number: { type: String, required: true },
      address: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },

    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
      },
    ],
    password: { type: String },
  
  },
  {
    timestamps: true,
    collection: "users",
  }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
