import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is missing from environment variables");
}

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy(retries) {
      if (retries > 10) {
        return new Error("Redis reconnect limit reached");
      }

      return Math.min(retries * 500, 3000);
    },
  },
});

redisClient.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});

redisClient.on("connect", () => {
  console.log("Connecting to Redis...");
});

redisClient.on("ready", () => {
  console.log("Redis connection ready");
});

redisClient.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});

export async function connectRedis() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    return redisClient.isReady;
  } catch (error) {
    console.error("Redis connection failed:", error.message);
    return false;
  }
}

export function isRedisReady() {
  return redisClient.isReady;
}

export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
}
