import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    reviewType: {
      type: String,
      enum: ["listing", "agent", "site"],
      required: true,
    },

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    rating: { type: Number, min: 1, max: 5, required: true },
    country: { type: String, trim: true },
  },
  { timestamps: true, collection: "reviews" }
);

export const Review =
  mongoose.models.Review || mongoose.model("Review", ReviewSchema);
