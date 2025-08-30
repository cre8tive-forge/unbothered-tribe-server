import streamifier from "streamifier";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";

export const upload = multer({ storage: multer.memoryStorage() });

export const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "properties" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          });
        }
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

export const deleteFromCloudinary = async (public_id) => {
  try {
    await cloudinary.uploader.destroy(public_id);
    console.log(`Successfully deleted image with public_id: ${public_id}`);
    return { success: true };
  } catch (error) {
    console.error(`Error deleting image with public_id: ${public_id}`, error);
    return { success: false, error };
  }
};
