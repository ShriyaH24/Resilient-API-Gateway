const fs = require("fs");
const path = require("path");
const { createClient } = require("redis");
require("dotenv").config();

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.connect();

const luaScript = fs.readFileSync(
  path.join(__dirname, "rateLimiter.lua"),
  "utf8"
);

// TOKEN BUCKET CONFIGURATION
const BUCKET_CAPACITY = 10;                     // Max burst capacity (tokens)
const REFILL_PERIOD_SECONDS = 60;              // Time period for full refill
const REFILL_RATE = BUCKET_CAPACITY / REFILL_PERIOD_SECONDS; // Tokens added per second (~0.1667)

module.exports = async function rateLimiter(req, res, next) {
  try {
    const key = `token_bucket:${req.apiKey || req.ip}`;
    const nowInSeconds = Math.floor(Date.now() / 1000);

    // Execute atomic Token Bucket script in Redis
    const [allowed, remainingTokens, retryAfter] = await redisClient.eval(
      luaScript,
      {
        keys: [key],
        arguments: [
          String(BUCKET_CAPACITY),
          String(REFILL_RATE),
          String(nowInSeconds),
        ],
      }
    );

    res.setHeader("X-RateLimit-Limit", BUCKET_CAPACITY);
    res.setHeader("X-RateLimit-Remaining", remainingTokens);
    res.setHeader("X-RateLimit-Reset", retryAfter);

    if (allowed === 0) {
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        error: "Too Many Requests",
        message: `Token bucket exhausted. Try again in ${retryAfter} seconds.`,
      });
    }

    next();
  } catch (err) {
    console.error("Rate limiter error (Failing Open):", err);
    // Fail-open policy: Allow traffic downstream during Redis outages
    next();
  }
};