import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    type: { type: String, required: true },
    date: { type: Date, required: true },
    client: { type: String, required: true },
    description: { type: String, required: true },
    images: [String],
  },
  {
    timestamps: true,
    collection: "projects",
  }
);

export const Projects =
  mongoose.models.Projects || mongoose.model("Projects", projectSchema);
