const prisma = require('../config/db');

class BaseRepository {
  constructor(modelName) {
    this.modelName = modelName;
    this.db = prisma[modelName];
  }

  async findById(id, include = null) {
    return this.db.findUnique({
      where: { id },
      include,
    });
  }

  async findMany(where = {}, include = null, orderBy = null, skip = 0, take = 50) {
    return this.db.findMany({
      where,
      include,
      orderBy,
      skip,
      take,
    });
  }

  async create(data, include = null) {
    return this.db.create({
      data,
      include,
    });
  }

  async update(id, data, include = null) {
    return this.db.update({
      where: { id },
      data,
      include,
    });
  }

  async delete(id) {
    return this.db.delete({
      where: { id },
    });
  }

  async count(where = {}) {
    return this.db.count({ where });
  }
}

module.exports = BaseRepository;
