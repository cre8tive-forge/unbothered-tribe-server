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
    balance: { type: Number, required: true, default: 0.0 },
    cancellation: { type: Number, required: true, default: 2 },
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
      firstname: { type: String, trim: true },
      lastname: { type: String, trim: true },
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
      number: { type: String },
      address: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String },
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
