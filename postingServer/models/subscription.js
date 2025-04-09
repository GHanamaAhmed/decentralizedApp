const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: false,
    },
    topic: {
      type: String,
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// Prevent duplicate subscriptions by the same user to the same topic
subscriptionSchema.index({ user: 1, topic: 1 }, { unique: true });

const Subscription =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", subscriptionSchema);

module.exports = Subscription;
