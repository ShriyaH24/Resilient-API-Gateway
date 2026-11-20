# Resilient API Gateway & Upstream REST Service

A high-performance, fault-tolerant **API Rate Limiter and Security Gateway** built with **Node.js, Express, Redis, and PostgreSQL (via Prisma ORM)**.

This project decouples core application business logic (managing code snippets) from edge-network concerns by handling API key authorization, atomic Lua-scripted rate limiting, fail-open resilience, and real-time observability at the gateway layer before proxying legitimate traffic to the upstream REST API.

---

## Architecture Overview

```text
                 Client (Postman / cURL)
                          │
                          ▼
                ┌─────────────────────┐
                │ Gateway (Port 3000) │
                └─────────────────────┘
                          │
                          ▼
            Real-Time Metrics Middleware
                          │
                          ▼
          API Key Authentication (x-api-key)
                          │
                          ▼
        Redis Rate Limiter (Atomic Lua Script)
                          │
                          ▼
              Redis Cache (Port 6379)
          (Fail-Open Policy on Outage)
                          │
                          ▼
             Upstream API (Port 4000)
                          │
                          ▼
        PostgreSQL Database (Port 5432)
```

---

## Features

- **Decoupled Architecture** – Independent microservices for the Gateway (Port 3000) and Upstream REST API (Port 4000).
- **Edge Authentication** – Validates API keys (`x-api-key`) before requests reach the rate limiter or database.
- **Atomic Rate Limiting** – Uses a server-side Redis Lua script to enforce request quotas atomically without race conditions or multiple network round-trips.
- **Fail-Open Fault Tolerance** – Allows traffic to continue if Redis becomes unavailable, prioritizing service availability over strict rate-limit enforcement.
- **Real-Time Observability** – Exposes a `/metrics` endpoint showing request volume, status code distribution, rolling average latency, and uptime.
- **PostgreSQL + Prisma ORM** – Type-safe database access with schema migrations and relational persistence.

---

## Repository Structure

```text
api-gateway-project/
│
├── docker-compose.yml          # PostgreSQL + Redis
│
├── api/                        # Upstream CRUD REST API
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── routes/
│   │   │   └── snippets.js
│   │   ├── db.js
│   │   └── index.js
│   └── package.json
│
└── gateway/                    # API Gateway
    ├── src/
    │   ├── middleware/
    │   │   ├── auth.js
    │   │   ├── rateLimiter.js
    │   │   ├── rateLimiter.lua
    │   │   └── metrics.js
    │   └── index.js
    └── package.json
```

---

# Getting Started

## Prerequisites

- Node.js v18+
- Docker Desktop

---

## 1. Start Infrastructure

From the project root:

```bash
docker compose up -d
```

This starts:

- PostgreSQL
- Redis

---

## 2. Configure Environment Variables

### `api/.env`

```env
DATABASE_URL="postgresql://dev:dev@localhost:5432/snippets?schema=public"
PORT=4000
```

### `gateway/.env`

```env
PORT=3000
UPSTREAM_URL="http://localhost:4000"
REDIS_URL="redis://localhost:6379"
VALID_API_KEYS="key-alpha,key-beta,key-gamma"
```

---

## 3. Setup and Start the Upstream API

```bash
cd api

npm install

npx prisma migrate dev --name init

npm run dev
```

Runs on:

```
http://localhost:4000
```

---

## 4. Setup and Start the Gateway

Open another terminal.

```bash
cd gateway

npm install

npm run dev
```

Runs on:

```
http://localhost:3000
```

---

# Testing & Verification

## API Endpoints

| Service | Method | Route | Description | Auth Required |
|---------|--------|-------|-------------|--------------|
| **Gateway** | `GET` | `/health` | Gateway health status |  No |
| **Gateway** | `GET` | `/metrics` | Traffic analytics |  No |
| **Upstream** | `GET` | `/api/v1/snippets` | Fetch all snippets |  Yes (`x-api-key`) |
| **Upstream** | `POST` | `/api/v1/snippets` | Create snippet |  Yes |
| **Upstream** | `GET` | `/api/v1/snippets/:id` | Get snippet by ID |  Yes |
| **Upstream** | `PUT` | `/api/v1/snippets/:id` | Update snippet |  Yes |
| **Upstream** | `DELETE` | `/api/v1/snippets/:id` | Delete snippet |  Yes |

---

## Test Rate Limiting (HTTP 429)

Send **11 rapid requests** within **60 seconds** using the same API key.

Example:

```bash
curl -H "x-api-key: key-alpha" \
http://localhost:3000/api/v1/snippets
```

Expected response on the **11th request**:

```http
HTTP/1.1 429 Too Many Requests
```

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 58 seconds."
}
```

---

## Test Fail-Open Resilience

Stop Redis:

```bash
docker compose stop redis
```

Send a request:

```bash
curl -i \
-H "x-api-key: key-alpha" \
http://localhost:3000/api/v1/snippets
```

Expected result:

- Request still succeeds (`200 OK`)
- Gateway logs a fail-open warning instead of crashing
- No `500 Internal Server Error`

Restart Redis:

```bash
docker compose start redis
```

---

## Check Metrics Endpoint

```
GET http://localhost:3000/metrics
```

Example response:

```json
{
  "totalRequests": 14,
  "averageLatencyMs": "4ms",
  "statusCodes": {
    "200": 12,
    "401": 1,
    "429": 1
  },
  "uptimeSeconds": 300
}
```

---

# Key Technical Decisions

## Authentication Before Rate Limiting

Authentication is significantly cheaper than a Redis lookup. Invalid API keys are rejected immediately, preventing unnecessary work and protecting backend resources.

---

## Atomic Redis Lua Scripts

Using `INCR` and `EXPIRE` separately requires multiple network round-trips and can introduce race conditions if execution stops between commands.

Executing both operations inside a Redis Lua script guarantees atomicity, consistency, and better performance.

---

## Fail-Open Resilience

Rather than making the API unavailable when Redis experiences an outage, the gateway temporarily bypasses rate limiting and forwards requests downstream.

This prioritizes overall system availability while ensuring users continue receiving service during cache failures.

---
