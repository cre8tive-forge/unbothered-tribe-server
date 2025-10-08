import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import contactRoute from "./routes/contactRoute.js";
import authRoute from "./routes/authRoute.js";
import connectToDB from "./library/mongodb.js";
import addressRoute from "./routes/addressRoute.js";
import newsletterRoute from "./routes/newsletterRoute.js";
import wishlistRoute from "./routes/wishlistRoute.js";
import productRoute from "./routes/productRoute.js";
import accountRoute from "./routes/accountRoute.js";
import timestampRoute from "./routes/timestampRoute.js";
import transactionRoute from "./routes/transactionRoute.js";
import orderRoute from "./routes/orderRoute.js";
import couponRoute from "./routes/couponRoute.js";

import mailRoute from "./routes/mailRoute.js";
import { getAccessToken } from "./config/zohoMailer.js";
import axios from "axios";
dotenv.config();

const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  "https://unbotheredtribe.vercel.app",
  "https://unbotheredtribe.com",
  "https://www.unbotheredtribe.com",
  "www.unbotheredtribe.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin.toLowerCase())) {
        callback(null, true);
      } else {
        console.error("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.options("*", cors());
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

app.use("/api/contact", contactRoute);
app.use("/api/auth", authRoute);
app.use("/api/address", addressRoute);
app.use("/api/newsletter", newsletterRoute);
app.use("/api/account", accountRoute);
app.use("/api/wishlist", wishlistRoute);
app.use("/api/product", productRoute);
app.use("/api/timestamp", timestampRoute);
app.use("/api/transaction", transactionRoute);
app.use("/api/order", orderRoute);
app.use("/api/coupon", couponRoute);
app.use("/api/mail", mailRoute);

connectToDB();

app.listen(process.env.PORT || 5000, () =>
  console.log(`Listening on PORT ${process.env.PORT}`)
);
