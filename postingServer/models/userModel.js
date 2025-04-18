const mongoose = require("mongoose");

// Define the schema for a user
const userSchema = new mongoose.Schema({
  // The user's unique username
  username: {
    type: String,
    required: true,
    unique: true, // ensures that no two users can have the same username
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
