import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../config/redis.js";

let generalLimiterInstance = null;
let loginLimiterInstance = null;
let otpLimiterInstance = null;

// Create each limiter outside request handling.
function buildLimiter({ prefix, windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    store: new RedisStore({
      prefix,
      sendCommand: (...args) => redisClient.sendCommand(args),
    }),

    message: {
      success: false,
      message,
    },

    handler: (req, res, next, options) => {
      return res.status(options.statusCode).json(options.message);
    },
  });
}

// Call this once after Redis connects.
export function initializeRateLimiters() {
  if (!redisClient.isReady) {
    throw new Error("Cannot initialize rate limiters: Redis is not connected.");
  }

  if (generalLimiterInstance && loginLimiterInstance && otpLimiterInstance) {
    return;
  }

  generalLimiterInstance = buildLimiter({
    prefix: "task-flow:rate:general:",
    windowMs: 60 * 1000,
    limit: 100,
    message: "Too many requests. Please try again shortly.",
  });

  loginLimiterInstance = buildLimiter({
    prefix: "task-flow:rate:login:",
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: "Too many login attempts. Please try again later.",
  });

  otpLimiterInstance = buildLimiter({
    prefix: "task-flow:rate:otp:",
    windowMs: 15 * 60 * 1000,
    limit: 3,
    message: "Too many OTP requests. Please try again later.",
  });

  console.log("Rate limiters initialized.");
}

// Stable middleware references can be registered before Redis connects.
function createRateLimitMiddleware(getLimiter) {
  return function rateLimitMiddleware(req, res, next) {
    const limiter = getLimiter();

    console.log("Rate limit debug:", {
      path: req.originalUrl,
      redisReady: redisClient.isReady,
      limiterInitialized: Boolean(limiter),
    });

    if (!redisClient.isReady || !limiter) {
      return res.status(503).json({
        success: false,
        message: "Rate limiting service is temporarily unavailable.",
      });
    }

    return limiter(req, res, next);
  };
}

export const generalApiLimiter = createRateLimitMiddleware(
  () => generalLimiterInstance,
);

export const loginRateLimiter = createRateLimitMiddleware(
  () => loginLimiterInstance,
);

export const otpRateLimiter = createRateLimitMiddleware(
  () => otpLimiterInstance,
);
