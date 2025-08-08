import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true },
    occupation: { type: String, required: true },
    message: { type: String, required: true },
    country: { type: String },
  },
  {
    timestamps: true,
    collection: "reviews",
  }
);

export const Reviews = mongoose.models.Reviews || mongoose.model("Reviews", ReviewSchema);
