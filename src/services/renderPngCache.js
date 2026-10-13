const MAX_CACHE_BYTES = 128 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 256;
const pngCache = new Map();
const inFlight = new Map();
let cachedBytes = 0;

function keyFor(id, pov) {
  return String(id) + ':' + String(pov);
}

export function getCachedRenderPng(id, pov) {
  const key = keyFor(id, pov);
  const png = pngCache.get(key);
  if (!png) return null;

  // Refresh LRU position.
  pngCache.delete(key);
  pngCache.set(key, png);
  return png;
}

export function hasCachedRenderPng(id, pov) {
  return pngCache.has(keyFor(id, pov));
}

export function cacheRenderPng(id, pov, png) {
  const key = keyFor(id, pov);
  const buffer = Buffer.isBuffer(png) ? png : Buffer.from(png);
  const previous = pngCache.get(key);
  if (previous) {
    cachedBytes -= previous.length;
    pngCache.delete(key);
  }

  // One unusually large render must not exceed the whole process image budget.
  if (buffer.length > MAX_CACHE_BYTES) return buffer;

  pngCache.set(key, buffer);
  cachedBytes += buffer.length;

  while (pngCache.size > MAX_CACHE_ENTRIES || cachedBytes > MAX_CACHE_BYTES) {
    const oldestKey = pngCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = pngCache.get(oldestKey);
    cachedBytes -= oldest.length;
    pngCache.delete(oldestKey);
  }
  return buffer;
}

export function getOrCreateRenderPng(id, pov, factory) {
  const cached = getCachedRenderPng(id, pov);
  if (cached) return Promise.resolve(cached);

  const key = keyFor(id, pov);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = Promise.resolve()
    .then(factory)
    .then(png => png ? cacheRenderPng(id, pov, png) : null)
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}
