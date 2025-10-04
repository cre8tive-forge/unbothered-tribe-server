import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectToDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) return;
    console.log("Connecting to database....");
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "unbotheredtribe-database",
    });
    console.log("Database connection successful ✅");
  } catch (error) {
    console.log("Database connection failed ❌", error);
  }
};

export default connectToDB;
