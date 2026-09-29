const { Schema, model } = require('mongoose');

const districtSchema = new Schema(
  {
    district_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    province_id: { type: String, required: true, index: true },
  },
  {
    collection: 'districts',
    versionKey: false,
  }
);

districtSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret._id;
    delete ret.__v;
    delete ret.api_key_hash;
    delete ret.password_hash;
    return ret;
  },
});

module.exports = model('District', districtSchema);
