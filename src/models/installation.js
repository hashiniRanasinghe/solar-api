const { Schema, model } = require('mongoose');

const installationSchema = new Schema(
  {
    installation_id: { type: String, required: true, unique: true },
    meter_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    substation_id: { type: String, required: true, index: true },
    district_id: { type: String, required: true, index: true },
    province_id: { type: String, required: true, index: true },
    capacity_kw: { type: Number, required: true },
    api_key_hash: { type: String },
  },
  {
    collection: 'installations',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// api_key_hash is not required (OQ-28 open) so a plain unique index would reject
// multiple documents with no key; index only where the field is a string.
installationSchema.index(
  { api_key_hash: 1 },
  { unique: true, partialFilterExpression: { api_key_hash: { $type: 'string' } } }
);

installationSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret._id;
    delete ret.__v;
    delete ret.api_key_hash;
    delete ret.password_hash;
    return ret;
  },
});

module.exports = model('Installation', installationSchema);
