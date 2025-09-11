import mongoose from "mongoose";

const advertismentSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: true,
    },
    company: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    number: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      required: true,
    },
    information: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", , "active", "expired", "cancelled"],
      default: "pending",
    },
    adType: {
      type: String,
      required: true,
      enum: [
        "Header Strip",
        "Takeover Banner",
        "Pop-Up Banner",
        "Middle Strip x2",
        "Featured Projects",
        "Leader Banner",
        "Side Board Banner",
        "Pop-Up Banner (Small)",
        "Carousel",
      ],
    },
    image: {
      url: {
        type: String,
        required: true,
      },
      public_id: String,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Advertisment =
  mongoose.models.Advertisment ||
  mongoose.model("Advertisment", advertismentSchema);
