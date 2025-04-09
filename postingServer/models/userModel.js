const mongoose = require("mongoose");

// Define the schema for a user
const userSchema = new mongoose.Schema({
  // The user's unique username
  username: {
    type: String,
    required: true,
    unique: true, // ensures that no two users can have the same username
  },
  // The user's email address
  email: {
    type: String,
    required: true,
    unique: true, // ensures that no two users can have the same email
  },
  // The user's password (note: it should be hashed before saving)
  password: {
    type: String,
    required: true,
  },
  // Optional field for the user's avatar image URL
  avatar: {
    type: String,
    default: null,
  },
  // Automatically set the account creation date
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Timestamp for the last update
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Optional pre-save hook to update the "updatedAt" field
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Create and export the User model
const User = mongoose.model("User", userSchema);
module.exports = User;
