import mongoose from 'mongoose';

const shootingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    shoot_date: { type: String, required: true }, // Format: YYYY-MM-DD
    director: { type: String, default: '' },
    channel: { type: String, default: '' },
    contract_amount: { type: Number, default: 0 },
    location: { type: String, default: '' },
    note: { type: String, default: '' },
    owner_id: { type: String, default: 'default_admin' },
  },
  { timestamps: true }
);

shootingSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
shootingSchema.set('toJSON', { virtuals: true });
shootingSchema.set('toObject', { virtuals: true });

export const Shooting = mongoose.model('Shooting', shootingSchema);
