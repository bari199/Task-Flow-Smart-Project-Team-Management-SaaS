import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});

export const connectRedis = async () => {
  if (redis.status === "wait") {
    await redis.connect();
  }

  await redis.ping();

  console.log("Redis connected successfully");
};
