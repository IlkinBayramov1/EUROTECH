/**
 * High-performance In-Memory & Redis-compatible Caching Layer
 */
class CacheService {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttlSeconds = 3600) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  get(key) {
    const record = this.store.get(key);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return record.value;
  }

  del(key) {
    this.store.delete(key);
  }

  flush() {
    this.store.clear();
  }

  async getOrSet(key, loaderFn, ttlSeconds = 3600) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    const freshValue = await loaderFn();
    this.set(key, freshValue, ttlSeconds);
    return freshValue;
  }
}

module.exports = new CacheService();
