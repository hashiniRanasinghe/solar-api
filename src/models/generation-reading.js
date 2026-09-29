const { Schema, model } = require('mongoose');

const generationReadingSchema = new Schema(
  {
    reading_id: { type: String, required: true, unique: true },
    installation_id: { type: String, required: true },
    timestamp: { type: Date, required: true },
    power_kw: { type: Number, required: true },
    energy_kwh: { type: Number, required: true },
    voltage: { type: Number, required: true },
    received_at: { type: Date, required: true },
  },
  {
    collection: 'generation_readings',
    versionKey: false,
  }
);

// Serves member lookup, idempotent device ingest (duplicate -> 409), and
// last-reading/history queries in both sort directions (read backwards).
generationReadingSchema.index({ installation_id: 1, timestamp: 1 }, { unique: true });

generationReadingSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret._id;
    delete ret.__v;
    delete ret.api_key_hash;
    delete ret.password_hash;
    return ret;
  },
});

module.exports = model('GenerationReading', generationReadingSchema);
