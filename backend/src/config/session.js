import session from "express-session";
import { RedisStore } from "connect-redis";
import { redisClient } from "./redis.js";

const isProduction = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required");
}

export const sessionMiddleware = session({
  name: "taskflow.sid",
  store: new RedisStore({
    client: redisClient,
    prefix: "taskflow:session:",
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24,
  },
});
