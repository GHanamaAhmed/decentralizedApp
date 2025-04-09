const mongoose = require("mongoose");

// Define a schema for a single comment,
// using a reference to the User model for the user who made the comment
const commentSchema = new mongoose.Schema({
  // Reference to the User document that authored the comment
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // This should match the model name defined in your user model
    required: true,
  },
  // The comment text content
  content: {
    type: String,
    required: true,
  },
  // Timestamp when the comment was created
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Main post schema
const postSchema = new mongoose.Schema({
  // Reference to the User document that created the post
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Matches the model name in your user model file
    required: true,
  },
  // The content of the post
  content: {
    type: String,
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  // Automatically store the creation date of the post
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // An array of comments that are embedded using the commentSchema
  comments: {
    type: [commentSchema],
    default: [],
  },
  // An array of references (User IDs) to track users who liked the post
  likes: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "User", // Each like is a reference to a User document
    default: [],
  },
});

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
