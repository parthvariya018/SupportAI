const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, minlength: 6, select: false },
  role:         { type: String, enum: ['owner', 'admin', 'agent', 'viewer'], default: 'agent' },
  avatar:       { type: String },
  defaultModel: { type: String, default: null },
  isActive:     { type: Boolean, default: true },
  lastSeenAt:   { type: Date },
  // Invite flow
  inviteToken:  { type: String, select: false },
  inviteExpires:{ type: Date,   select: false },
  // Password reset flow
  passwordResetToken:   { type: String, select: false },
  passwordResetExpires: { type: Date,   select: false },
}, {
  timestamps: true,
  toJSON: { transform(_, ret) { delete ret.password; return ret; } },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
