import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
    reference: {
      type: String,
      required: true,
    },
    plan: {
      type: String,
      required: true,
      enum: ["Basic", "Premium", "Professional"],
    },
    status: {
      type: String,
      enum: ["Active", "Expired", "Cancelled"],
      default: "Active",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true, collection: "subscriptions" }
);

export const Subscription =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", subscriptionSchema);
