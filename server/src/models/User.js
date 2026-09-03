import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, lowercase: true, index: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    password: { type: String, required: true },
    name: { type: String, default: 'Admin' },
    role: { type: String, enum: ['admin', 'manager', 'viewer'], default: 'admin' },
    phone: { type: String, default: '' },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model('User', userSchema);
