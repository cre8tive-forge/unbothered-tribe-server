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

    regularPrice: { type: Number, required: true, default: 0 },
    salePrice: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    inStock: { type: Boolean, default: true },
    sale: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
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

    location: {
      state: { type: String, required: true },
      area: { type: String, required: true },
      locality: { type: String, required: true },
      zipCode: { type: String },
      street: { type: String },
    },

    category: { type: String },
    subCategory: { type: String },
    price: { type: Number, required: true },
    cautionFee: { type: Number },
    serviceCharge: { type: Number },
    agencyFee: { type: Number },
    denomination: { type: String, default: "NGN" },
    installmentPayment: { type: Boolean, default: false },
    appendTo: { type: String },
    bedrooms: { type: Number },
    bathrooms: { type: Number },
    toilets: { type: Number },
    areaSize: { type: String },
    description: { type: String },
    features: [{ type: String }],
    youtubeVideo: { type: String },
    instagramVideo: { type: String },
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["pending", "active", "sold", "rented", "archived"],
      default: "pending",
    },
    isFeatured: { type: Boolean, default: false },
    onHomepage: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    coordinates: {
      lat: Number,
      lng: Number,
    },
    documents: [{ type: String }],
    virtualTour: { type: String },
  },
  {
    timestamps: true,
    collection: "listings",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const Property =
  mongoose.models.Property || mongoose.model("Property", productSchema);
