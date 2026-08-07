### Resilient API Gateway & Upstream REST Service

A high-performance, fault-tolerant **API Rate Limiter and Security Gateway** built with **Node.js, Express, Redis, and PostgreSQL (via Prisma ORM)**. 

This project decouples core application business logic (managing code snippets) from edge-network concerns—handling API key authorization, atomic Lua-scripted rate limiting, fail-open resilience, and real-time observability at the gateway layer before proxying legitimate traffic to the upstream REST API.


### Architecture Overview

 Client (Postman/cURL)
        │
        ▼
   [ Gateway ] (Port 3000) ──▶ Real-time Metrics Middleware
        │
        ├─▶ 1. Auth Check (Header: x-api-key)
        │
        ├─▶ 2. Redis Rate Limiter (Atomic Lua Script)
        │     │
        │     └─▶ [ Redis Cache ] (Port 6379)
        │           └─▶ (Fail-Open Policy on Outage)
        │
        ▼
   [ Upstream API ] (Port 4000)
        │
        └─▶ [ PostgreSQL Database ] (Port 5432)
        

###Features
Decoupled Architecture: Independent microservices for Gateway (port 3000) and Upstream REST API (port 4000).

Edge Authentication: Validates API keys (x-api-key) before requests touch the rate limiter or database.

Atomic Rate Limiting: Uses a server-side Redis Lua script to calculate request quotas atomically without race conditions or multiple network round-trips.

Fail-Open Fault Tolerance: Built-in resilience strategy that allows traffic to pass downstream if Redis goes offline, prioritizing system availability over strict enforcement during outages.

Real-Time Observability: Exposed /metrics endpoint tracking request volume, status code distributions (200, 401, 429), and rolling average latency.

PostgreSQL & Prisma ORM: Relational database storage with schema migrations and type safety.


###Repository Structure
api-gateway-project/
├── docker-compose.yml       # Datastores (PostgreSQL + Redis)
├── api/                     # Upstream CRUD REST API
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── routes/snippets.js
│   │   ├── db.js
│   │   └── index.js
│   └── package.json
└── gateway/                 # API Security Gateway Service
    ├── src/
    │   ├── middleware/
    │   │   ├── auth.js
    │   │   ├── rateLimiter.js
    │   │   ├── rateLimiter.lua
    │   │   └── metrics.js
    │   └── index.js
    └── package.json


###Getting Started:
Prerequisites: Node.js (v18+), Docker Desktop1. 

##1.Start Infrastructure (PostgreSQL & Redis):
In the root directory, run: docker compose up -d

##2. Configure Environment Variables: 
Create .env in the api/ directory:Code snippetDATABASE_URL="postgresql://dev:dev@localhost:5432/snippets?schema=public"
PORT=4000
Create .env in the gateway/ directory:Code snippetPORT=3000
UPSTREAM_URL="http://localhost:4000"
REDIS_URL="redis://localhost:6379"
VALID_API_KEYS="key-alpha,key-beta,key-gamma"

##3. Setup and Start Upstream API (Port 4000)Open a terminal window:
cd api
npm install
npx prisma migrate dev --name init
npm run dev

##4. Setup and Start Gateway Service (Port 3000)Open a second terminal window:Bashcd gateway
npm install
npm run dev


###Testing & Verification: API Endpoints Overview
### API Endpoints Overview

| Service | Method | Route | Description | Auth Required |
|---|---|---|---|---|
| **Gateway** | `GET` | `/health` | Gateway service status | ❌ No |
| **Gateway** | `GET` | `/metrics` | Real-time traffic analytics | ❌ No |
| **Upstream** | `GET` | `/api/v1/snippets` | Fetch all code snippets | 🔑 Yes (`x-api-key`) |
| **Upstream** | `POST` | `/api/v1/snippets` | Create a code snippet | 🔑 Yes (`x-api-key`) |
| **Upstream** | `GET` | `/api/v1/snippets/:id` | Get single snippet | 🔑 Yes (`x-api-key`) |
| **Upstream** | `PUT` | `/api/v1/snippets/:id` | Update snippet | 🔑 Yes (`x-api-key`) |
| **Upstream** | `DELETE` | `/api/v1/snippets/:id` | Delete snippet | 🔑 Yes (`x-api-key`) |

##3. Test Rate Limiting Enforcement (429 Too Many Requests):
Send 11 rapid requests within 60 seconds with x-api-key: key-alpha. On the 11th request:
Expected Output: HTTP/1.1 429 Too Many RequestsJSON{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 58 seconds."
}

##4. Test Fail-Open Resilience PolicyStop the Redis container:Bashdocker compose stop redis
Send an API request through the gateway:curl -i -H "x-api-key: key-alpha" http://localhost:3000/api/v1/snippets
Result: Returns 200 OK safely instead of crashing with a 500 error. The gateway catches the disconnection and logs Rate limiter error (Failing Open).
Restart Redis:docker compose start redis

##5. Check Metrics Endpoint: http://localhost:3000/metrics
Sample Output:JSON{
  "totalRequests": 14,
  "averageLatencyMs": "4ms",
  "statusCodes": {
    "200": 12,
    "401": 1,
    "429": 1
  },
  "uptimeSeconds": 300
} 


###Key Technical Decisions:
1.Why Auth runs before Rate Limiting: Authenticating headers is computationally cheap. Rejecting invalid requests early prevents wasting Redis lookups on unauthorized traffic.
2.Why Redis Lua Scripting: Standard INCR + EXPIRE in JavaScript requires two network round-trips and creates race conditions if process execution halts between steps. A Lua script executes as a single atomic transaction inside Redis.
3.Fail-Open Policy Design: For general web API architectures, system availability is prioritized over strict limit enforcement. If the caching layer experiences an outage, requests continue to serve downstream rather than returning full service outages to end users.
