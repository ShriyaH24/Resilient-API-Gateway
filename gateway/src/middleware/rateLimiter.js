const fs = require("fs");
const path = require("path");
const { createClient } = require("redis");
require("dotenv").config();

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.connect();

// Load Lua script into memory
const luaScript = fs.readFileSync(
  path.join(__dirname, "rateLimiter.lua"),
  "utf8"
);

const WINDOW_IN_SECONDS = 60;
const MAX_REQUESTS = 10;

module.exports = async function rateLimiter(req, res, next) {
  try {
    const key = `rate_limit:${req.apiKey || req.ip}`;

    // Execute atomic Lua script in Redis
    const [allowed, count, ttl] = await redisClient.eval(luaScript, {
      keys: [key],
      arguments: [String(MAX_REQUESTS), String(WINDOW_IN_SECONDS)],
    });

    res.setHeader("X-RateLimit-Limit", MAX_REQUESTS);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, MAX_REQUESTS - count));
    res.setHeader("X-RateLimit-Reset", ttl);

    if (allowed === 0) {
      res.setHeader("Retry-After", ttl);
      return res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${ttl} seconds.`,
      });
    }

    next();
  } catch (err) {
    console.error("Rate limiter error (Failing Open):", err);
    // Fail-Open Policy: If Redis goes down, allow traffic to pass through
    next();
  }
};