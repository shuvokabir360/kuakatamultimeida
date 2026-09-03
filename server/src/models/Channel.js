import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    is_own: { type: Boolean, default: false },
    logo_url: { type: String, default: '' },
    color: { type: String, default: '' },
    owner_id: { type: String, default: 'default_admin' },
  },
  { timestamps: true }
);

channelSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
channelSchema.set('toJSON', { virtuals: true });
channelSchema.set('toObject', { virtuals: true });

export const Channel = mongoose.model('Channel', channelSchema);
