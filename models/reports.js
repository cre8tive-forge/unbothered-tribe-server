import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true },
    email: { type: String, required: true },
    number: { type: String, required: true },
    category: { type: String, required: true },
    message: { type: String, required: true },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    country: { type: String },
    status: {
      type: String,
      enum: ["pending", "resolved"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "reports",
  }
);

export const Report =
  mongoose.models.Report || mongoose.model("Report", reportSchema);
