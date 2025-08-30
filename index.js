import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import contactRoute from "./routes/contactRoute.js";
import authRoute from "./routes/authRoute.js";
import reviewRoute from "./routes/reviewRoute.js";
import lisitingRoute from "./routes/lisitingRoute.js";
import wishlistRoute from "./routes/wishlistRoute.js";
import agentRoute from "./routes/agentRoute.js";
import enquiryRoute from "./routes/enquiryRoute.js";
import statisticsRoute from "./routes/statisticsRoute.js";
import timestampRoute from "./routes/timestampRoute.js";
import blogRoute from "./routes/blogRoute.js";
import userRoute from "./routes/userRoute.js";
import connectToDB from "./library/mongodb.js";
dotenv.config();

const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  "https://rentatruck-listing.vercel.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());
app.get("/", (request, response) => {
  response.send("Hey there! I am handling this server!");
});
app.use("/api/contact", contactRoute);
app.use("/api/auth", authRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/wishlist", wishlistRoute);
app.use("/api/listing", lisitingRoute);
app.use("/api/agent", agentRoute);
app.use("/api/enquiry", enquiryRoute);
app.use("/api/user", userRoute);
app.use("/api/statistics", statisticsRoute);
app.use("/api/timestamp", timestampRoute);
app.use("/api/blog", blogRoute);

connectToDB();
app.listen(process.env.PORT, () =>
  console.log(`Listening on PORT ${process.env.PORT}`)
);
