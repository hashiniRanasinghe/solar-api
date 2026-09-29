const { Schema, model } = require('mongoose');

const substationSchema = new Schema(
  {
    substation_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    district_id: { type: String, required: true, index: true },
    province_id: { type: String, required: true, index: true },
  },
  {
    collection: 'substations',
    versionKey: false,
  }
);

substationSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret._id;
    delete ret.__v;
    delete ret.api_key_hash;
    delete ret.password_hash;
    return ret;
  },
});

module.exports = model('Substation', substationSchema);
