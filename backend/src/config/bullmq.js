import "dotenv/config";

function createBullMQConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is missing");
  }

  const url = new URL(redisUrl);

  const connection = {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null,
  };

  if (url.username) {
    connection.username = decodeURIComponent(url.username);
  }

  if (url.password) {
    connection.password = decodeURIComponent(url.password);
  }

  if (url.pathname.length > 1) {
    connection.db = Number(url.pathname.slice(1));
  }

  if (url.protocol === "rediss:") {
    connection.tls = {};
  }

  return connection;
}

export const bullMQConnection = createBullMQConnection();
