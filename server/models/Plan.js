const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name:     { type: String, enum: ['free', 'starter', 'pro', 'enterprise'], unique: true },
  limits: {
    agents:           { type: Number, default: 1 },
    messagesPerMonth: { type: Number, default: 500 },
    documents:        { type: Number, default: 3 },
    storageGB:        { type: Number, default: 0.5 },
    apiCallsPerDay:   { type: Number, default: 100 },
  },
  price: {
    monthly: { type: Number, default: 0 },
    yearly:  { type: Number, default: 0 },
  },
  stripePriceId: {
    monthly: { type: String },
    yearly:  { type: String },
  },
  features: [String],
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
