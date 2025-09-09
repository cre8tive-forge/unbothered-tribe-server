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
    middlename: { type: String, trim: true },
    lastname: { type: String, trim: true },
    number: { type: String, trim: true },
    whatsappNumber: { type: String, trim: true },
    bio: { type: String },
    country: { type: String, trim: true, default: "Nigeria" },
    status: {
      type: String,
      enum: ["active", "suspended", "banned"],
      default: "active",
    },
    kycStatus: {
      type: String,
      enum: ["unverified", "verified", "rejected", "pending"],
      default: "unverified",
    },
    totalisting: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    role: {
      type: String,
      required: true,
      enum: ["User", "Agent", "Admin"],
    },
    favoriteListings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
      },
    ],
    password: { type: String },
    profilePhoto: {
      type: String,
      default: "https://robohash.org/david",
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    subscribed: {
      type: Boolean,
      default: false,
    },
    listingLimit: {
      type: Number,
      default: 1,
    },
    views: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
