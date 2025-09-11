import mongoose from "mongoose";

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "published"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "faqs",
  }
);

export const Faq = mongoose.models.Faq || mongoose.model("Faq", faqSchema);
