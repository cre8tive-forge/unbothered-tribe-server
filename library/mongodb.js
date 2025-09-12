import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectToDB = async () => {
  try {
   
    if (mongoose.connection.readyState === 1) return;
     console.log("Connecting to database....");
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "househunter-database",
    });
    console.log("Database connection successful ✅");
  } catch (error) {
    console.log("Database connection failed ❌", error);
    // console.error("Database connection error:", error);
  }
};

export default connectToDB;
