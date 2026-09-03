import mongoose from 'mongoose';

const clientPaymentSchema = new mongoose.Schema(
  {
    shooting_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shooting' },
    channel: { type: String, required: true },
    amount: { type: Number, required: true },
    received_at: { type: String, default: () => new Date().toISOString().split('T')[0] },
    method: { type: String, default: '' },
    note: { type: String, default: '' },
    owner_id: { type: String, default: 'default_admin' },
  },
  { timestamps: true }
);

clientPaymentSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
clientPaymentSchema.set('toJSON', { virtuals: true });
clientPaymentSchema.set('toObject', { virtuals: true });

export const ClientPayment = mongoose.model('ClientPayment', clientPaymentSchema);
