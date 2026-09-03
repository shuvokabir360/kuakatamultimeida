import mongoose from 'mongoose';

const directorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    photo_url: { type: String, default: '' },
    owner_id: { type: String, default: 'default_admin' },
  },
  { timestamps: true }
);

directorSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
directorSchema.set('toJSON', { virtuals: true });
directorSchema.set('toObject', { virtuals: true });

export const Director = mongoose.model('Director', directorSchema);
