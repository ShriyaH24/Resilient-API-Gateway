const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const authMiddleware = require("./middleware/auth");
const rateLimiter = require("./middleware/rateLimiter");
const { metricsLogger, getMetrics } = require("./middleware/metrics");

const app = express();
const PORT = process.env.PORT || 3000;
const UPSTREAM_URL = process.env.UPSTREAM_URL || "http://localhost:4000";

// Track all incoming traffic across the gateway
app.use(metricsLogger);

// Unprotected Health & Metrics routes[cite: 1]
app.get("/health", (req, res) => res.json({ status: "OK", service: "API Gateway" }));
app.get("/metrics", getMetrics);

// Apply Auth and Rate Limiting to /api routes
app.use("/api", authMiddleware, rateLimiter);

// Forward requests to upstream
app.use(
  "/api",
  createProxyMiddleware({
    target: UPSTREAM_URL,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/" },
  })
);

app.listen(PORT, () => {
  console.log(`Gateway running on http://localhost:${PORT}`);
});