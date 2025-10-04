import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    country: { type: String },
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "contacts",
  }
);

export const Contact =
  mongoose.models.Contact || mongoose.model("Contact", ContactSchema);
