import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
    paid_at: { type: Date, default: Date.now },
    owner_id: { type: String, default: 'default_admin' },
  },
  { timestamps: true }
);

paymentSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

export const Payment = mongoose.model('Payment', paymentSchema);
