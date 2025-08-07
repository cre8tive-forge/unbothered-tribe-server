import mongoose from "mongoose";

const Login_codes_schema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    code: { type: String, required: true },
    expires_at: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: "login_codes",
  }
);

export const LoginCodes =
  mongoose.models.LoginCodes ||
  mongoose.model("LoginCodes", Login_codes_schema);
