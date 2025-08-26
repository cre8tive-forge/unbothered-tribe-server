import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
    agentName: { type: String, required: true, trim: true },
    agentImage: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false },
    message: { type: String, required: true, trim: true },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    country: { type: String, trim: true },
  },
  { timestamps: true, collection: "enquiries" }
);

export const Enquiry =
  mongoose.models.Enquiry || mongoose.model("Enquiry", enquirySchema);
