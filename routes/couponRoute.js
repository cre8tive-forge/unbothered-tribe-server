import express from "express";
import { Coupon } from "../models/coupons.js";

const router = express.Router();
router.post("/validate", async (req, res) => {
  try {
    const { code, orderTotal } = req.body;

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.status(404).json({ message: "Invalid coupon code" });
    }

    if (coupon.isUsed) {
      return res.status(400).json({ message: "Coupon has already been used" });
    }

    if (new Date() > coupon.expiryDate) {
      return res.status(400).json({ message: "Coupon has expired" });
    }
    const discount = (orderTotal * coupon.discountPercentage) / 100;
    const newTotal = orderTotal - discount;
    res.json({
      message: "Coupon applied successfully",
      discount,
      newTotal,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: true,
      message: "Unable to validate coupon code. Please try again",
    });
  }
});

export default router;
