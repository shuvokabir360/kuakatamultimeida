import mongoose from 'mongoose';

const bonusSchema = new mongoose.Schema(
  {
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    amount: { type: Number, required: true },
    reason: { type: String, default: '' },
    given_at: { type: Date, default: Date.now },
    owner_id: { type: String, default: 'default_admin' },
  },
  { timestamps: true }
);

bonusSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
bonusSchema.set('toJSON', { virtuals: true });
bonusSchema.set('toObject', { virtuals: true });

export const Bonus = mongoose.model('Bonus', bonusSchema);
