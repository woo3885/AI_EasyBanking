interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class AiCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number = 5 * 60 * 1000,
    private readonly maxEntries: number = 100,
  ) {}

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;

      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}