import mongoose from "mongoose";
const commentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
    country: {
      type: String,
    },
    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "blog_comments",
  }
);

export const BlogComment = mongoose.model("BlogComment", commentSchema);
