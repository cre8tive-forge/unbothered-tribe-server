import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    country: { type: String },
  },
  {
    timestamps: true,
    collection: "contacts",
  }
);

export const Contacts = mongoose.models.Contacts || mongoose.model("Contacts", ContactSchema);
