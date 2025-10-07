import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    regularPrice: { type: Number, required: true, default: 0.0 },
    salePrice: { type: Number, required: true, default: 0.0 },
    quantity: { type: Number, required: true, default: 1 },
    inStock: { type: Boolean, default: true },
    sale: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    sizes: [{ type: String }],
    description: {
      information: [{ type: String }],
      details: {
        fabric: { type: String },
        baseColor: { type: String },
        pantsLength: { type: String },
        jacketLength: { type: String },
      },
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        public_id: {
          type: String,
          required: true,
        },
      },
    ],
    category: { type: String, default: "Clothing" },
    subCategory: { type: String, default: "Shirts" },

    status: {
      type: String,
      enum: ["pending", "active", "sold", "rented", "archived"],
      default: "pending",
    },
    views: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "products",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
