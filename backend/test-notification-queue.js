import "dotenv/config";

import { connectRedis, disconnectRedis } from "./src/config/redis.js";

import { enqueueNotificationJob } from "./src/queues/notification.queue.js";

async function testNotificationQueue() {
  try {
    const connected = await connectRedis();

    if (!connected) {
      throw new Error("Could not connect to Redis");
    }

    await enqueueNotificationJob({
      eventId: `dev-test-${Date.now()}`,
      message: "Task Flow queue test",
    });

    console.log("Notification job enqueued");
  } catch (error) {
    console.error("Notification queue test failed:", error);

    process.exitCode = 1;
  } finally {
    await disconnectRedis();
  }
}

await testNotificationQueue();
