const { Schema, model } = require('mongoose');

const provinceSchema = new Schema(
  {
    province_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
  },
  {
    collection: 'provinces',
    versionKey: false,
  }
);

provinceSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret._id;
    delete ret.__v;
    delete ret.api_key_hash;
    delete ret.password_hash;
    return ret;
  },
});

module.exports = model('Province', provinceSchema);
