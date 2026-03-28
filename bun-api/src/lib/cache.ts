import { RedisClient } from "bun";

import { config } from "../config";

const cacheUrl = `valkey://${config.cacheHost}:${config.cachePort}`;

export const redisClient = new RedisClient(cacheUrl, {
  connectionTimeout: 10000,
  enableAutoPipelining: true
});

export const CACHE_TTL_SECONDS = 300;

export function todosCacheKey(userId: string) {
  return `todos:user:${userId}`;
}

export function todoCacheKey(id: string) {
  return `todo:${id}`;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const value = await redisClient.get(key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttl = CACHE_TTL_SECONDS) {
  await redisClient.set(key, JSON.stringify(value), "EX", ttl);
}

export async function deleteKeys(...keys: string[]) {
  if (keys.length === 0) {
    return 0;
  }

  return redisClient.del(...keys);
}
