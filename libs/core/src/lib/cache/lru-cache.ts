interface LruEntry<T> {
  value: T;
  expiresAt: number;
}

export class LruCache<T> {
  private readonly cache = new Map<string, LruEntry<T>>();

  constructor(private readonly maxSize: number) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    // Delete first so re-insertion moves to end
    this.cache.delete(key);

    if (this.cache.size >= this.maxSize) {
      // Evict oldest (first inserted)
      const oldest = this.cache.keys().next().value as string;
      this.cache.delete(oldest);
    }

    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  keys(): IterableIterator<string> {
    return this.cache.keys();
  }

  get size(): number {
    return this.cache.size;
  }
}
