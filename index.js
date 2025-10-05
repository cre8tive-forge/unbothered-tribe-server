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
import accountRoute from "./routes/accountRoute.js";
import reviewRoute from "./routes/reviewRoute.js";
import lisitingRoute from "./routes/lisitingRoute.js";

import agentRoute from "./routes/agentRoute.js";
import enquiryRoute from "./routes/enquiryRoute.js";
import statisticsRoute from "./routes/statisticsRoute.js";
import timestampRoute from "./routes/timestampRoute.js";
import subscriptionRoute from "./routes/subscriptionRoute.js";
import transactionRoute from "./routes/transactionRoute.js";

import settingsRoute from "./routes/settingsRoute.js";
import reportRoute from "./routes/reportRoute.js";
import advertismentRoute from "./routes/advertismentRoute.js";
import faqRoute from "./routes/faqRoute.js";
import mailRoute from "./routes/mailRoute.js";
import blogRoute from "./routes/blogRoute.js";
import userRoute from "./routes/userRoute.js";

import monitors from "./library/cron-jobs.js";
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
// app.use("/api/listing", lisitingRoute);
// app.use("/api/agent", agentRoute);
// app.use("/api/enquiry", enquiryRoute);
// app.use("/api/user", userRoute);
// app.use("/api/statistics", statisticsRoute);
// app.use("/api/timestamp", timestampRoute);
// app.use("/api/blog", blogRoute);
// app.use("/api/subscription", subscriptionRoute);
// app.use("/api/transaction", transactionRoute);

// app.use("/api/settings", settingsRoute);
// app.use("/api/faq", faqRoute);
// app.use("/api/report", reportRoute);
// app.use("/api/advertisment", advertismentRoute);
// app.use("/api/mail", mailRoute);

connectToDB();

app.listen(process.env.PORT || 5000, () =>
  console.log(`Listening on PORT ${process.env.PORT}`)
);
