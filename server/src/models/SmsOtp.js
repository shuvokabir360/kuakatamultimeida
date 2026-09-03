import mongoose from 'mongoose';

const smsOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    code: { type: String, required: true },
    expires_at: { type: Date, required: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const SmsOtp = mongoose.model('SmsOtp', smsOtpSchema);
