import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    role: { type: String, default: '' },
    type: { type: String, enum: ['daily', 'monthly'], required: true, default: 'daily' },
    rate: { type: Number, required: true, default: 0 },
    photo_url: { type: String, default: '' },
    owner_id: { type: String, default: 'default_admin' },
  },
  { timestamps: true }
);

// Virtual for ID compatibility
memberSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
memberSchema.set('toJSON', { virtuals: true });
memberSchema.set('toObject', { virtuals: true });

export const Member = mongoose.model('Member', memberSchema);
