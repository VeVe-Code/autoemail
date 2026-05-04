const mongoose = require("mongoose");

const provisionedAccountSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      index: true
    },
    provider: {
      type: String,
      default: "plesk"
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    username: {
      type: String,
      required: true
    },
    password: {
      type: String,
      required: true
    },
    otpMode: {
      type: String,
      enum: ["manual", "api", "none"],
      default: "none"
    },
    status: {
      type: String,
      enum: ["created", "failed"],
      required: true
    },
    errorMessage: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("ProvisionedAccount", provisionedAccountSchema);
