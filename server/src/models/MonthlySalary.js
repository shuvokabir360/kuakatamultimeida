import mongoose from 'mongoose';

const monthlySalarySchema = new mongoose.Schema(
  {
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    month: { type: String, required: true }, // Format: YYYY-MM-01 or YYYY-MM
    amount: { type: Number, required: true, default: 0 },
    owner_id: { type: String, default: 'default_admin' },
  },
  { timestamps: true }
);

monthlySalarySchema.index({ member_id: 1, month: 1 }, { unique: true });
monthlySalarySchema.virtual('id').get(function () {
  return this._id.toHexString();
});
monthlySalarySchema.set('toJSON', { virtuals: true });
monthlySalarySchema.set('toObject', { virtuals: true });

export const MonthlySalary = mongoose.model('MonthlySalary', monthlySalarySchema);
