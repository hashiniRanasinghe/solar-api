const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    user_id: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    role: { type: String, required: true, enum: ['reader', 'admin'] },
    jurisdiction_level: {
      type: String,
      required: true,
      enum: ['national', 'province', 'district'],
    },
    jurisdiction_id: { type: String },
  },
  {
    collection: 'users',
    versionKey: false,
  }
);

userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret._id;
    delete ret.__v;
    delete ret.api_key_hash;
    delete ret.password_hash;
    return ret;
  },
});

module.exports = model('User', userSchema);
