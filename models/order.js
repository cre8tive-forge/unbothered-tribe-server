import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: { type: String, required: true },
        images: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
      },
    ],

    deliveryDetails: {
      firstname: String,
      lastname: String,
      email: String,
      number: String,
      address: String,
      state: String,
      country: String,
      zipCode: String,
      note: String,
    },

    payment: {
      transactionId: String,
      reference: String,
      status: {
        type: String,
        enum: ["pending", "success", "failed"],
        default: "pending",
      },
      amount: { type: Number },
      currency: { type: String, default: "NGN" },
      method: { type: String, default: "bank" },
      paidAt: Date,
    },

    orderStatus: {
      type: String,
      enum: ["processing", "shipped", "delivered", "cancelled"],
      default: "processing",
    },
  },
  { timestamps: true, collection: "orders" }
);

export const Order =
  mongoose.models.Order || mongoose.model("Order", orderSchema);
