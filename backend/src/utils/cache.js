import { redisClient } from "../config/redis.js";

const DEFAULT_TTL_SECONDS = 60;

export async function getCache(key) {
  try {
    if (!redisClient.isReady) return null;

    const value = await redisClient.get(key);

    if (value === null) return null;

    return JSON.parse(value);
  } catch (error) {
    console.error("Redis cache read failed:", error.message);
    return null;
  }
}

export async function setCache(key, data, ttlSeconds = DEFAULT_TTL_SECONDS) {
  try {
    if (!redisClient.isReady) return false;

    await redisClient.set(key, JSON.stringify(data), {
      EX: ttlSeconds,
    });

    return true;
  } catch (error) {
    console.error("Redis cache write failed:", error.message);
    return false;
  }
}

export async function deleteCache(key) {
  try {
    if (!redisClient.isReady) return false;

    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error("Redis cache delete failed:", error.message);
    return false;
  }
}

export async function deleteCacheByPattern(pattern) {
  try {
    if (!redisClient.isReady) return false;

    // SCAN avoids blocking Redis like KEYS can.
    for await (const keys of redisClient.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }

    return true;
  } catch (error) {
    console.error("Redis cache invalidation failed:", error.message);
    return false;
  }
}
