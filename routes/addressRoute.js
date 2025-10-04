import express from "express";
import { User } from "../models/users.js";
import { Timestamp } from "../models/timestamps.js";
import jwt from "jsonwebtoken";
import verifyToken from "../middleware/verifyToken.js";
const router = express.Router();

router.post("/update", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const {
    firstname,
    lastname,
    email,
    number,
    address,
    state,
    country,
    zipCode,
  } = req.body;

  try {
    const updateFields = {
      "address.firstname": firstname,
      "address.lastname": lastname,
      "address.email": email,
      "address.number": number,
      "address.address": address,
      "address.state": state,
      "address.country": country,
      "address.zipCode": zipCode,
    };

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $set: updateFields },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({
        error: true,
        message: "User not found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "user" },
      { updatedAt: Date.now() },
      { new: true }
    );

    const userObj = updatedUser.toObject();
    delete userObj.password;

    const payload = {
      id: updatedUser._id,
      ...userObj,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return res
      .cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "None",
        maxAge: 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({
        error: false,
        token,
        user: userObj,
        message: "Shipping Address updated successfully",
      });
  } catch (err) {
    console.error("Error updating shipping address:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to update shipping address. Please try again later.",
    });
  }
});
export default router;
