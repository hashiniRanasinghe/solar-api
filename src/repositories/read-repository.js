// Read access for one collection. Documents are not lean, so the model's
// toJSON still removes _id and the hidden fields when they are sent.
function createReadRepository(Model, idField, hiddenFields = '') {
  async function findPage({ filter, sort, offset, limit }) {
    const [items, count] = await Promise.all([
      Model.find(filter).select(hiddenFields).sort(sort).skip(offset).limit(limit),
      Model.countDocuments(filter),
    ]);
    return { items, count };
  }

  async function findById(id) {
    return Model.findOne({ [idField]: id }).select(hiddenFields);
  }

  return { findPage, findById };
}

module.exports = { createReadRepository };
