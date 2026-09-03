import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    present: { type: Boolean, default: true },
    shooting_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shooting', default: null },
    rate_override: { type: Number, default: null },
    owner_id: { type: String, default: 'default_admin' },
  },
  { timestamps: true }
);

attendanceSchema.index({ member_id: 1, date: 1 }, { unique: true });
attendanceSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
attendanceSchema.set('toJSON', { virtuals: true });
attendanceSchema.set('toObject', { virtuals: true });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
