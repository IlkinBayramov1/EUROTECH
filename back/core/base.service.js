class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  async getById(id, include = null) {
    const item = await this.repository.findById(id, include);
    if (!item) {
      throw new Error(`Resource with ID ${id} not found`);
    }
    return item;
  }

  async getAll(where = {}, include = null, orderBy = null, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.repository.count(where),
      this.repository.findMany(where, include, orderBy, skip, limit),
    ]);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  async create(data, include = null) {
    return this.repository.create(data, include);
  }

  async update(id, data, include = null) {
    return this.repository.update(id, data, include);
  }

  async delete(id) {
    return this.repository.delete(id);
  }
}

module.exports = BaseService;
