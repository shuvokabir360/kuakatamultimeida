import mongoose from 'mongoose';

const shootingExpenseSchema = new mongoose.Schema(
  {
    shooting_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shooting', required: true },
    amount: { type: Number, required: true, default: 0 },
    note: { type: String, default: '' },
    spent_at: { type: Date, default: Date.now },
    owner_id: { type: String, default: 'default_admin' },
  },
  { timestamps: true }
);

shootingExpenseSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
shootingExpenseSchema.set('toJSON', { virtuals: true });
shootingExpenseSchema.set('toObject', { virtuals: true });

export const ShootingExpense = mongoose.model('ShootingExpense', shootingExpenseSchema);
