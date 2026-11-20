local key = KEYS[1]
local capacity = tonumber(ARGV[1])      -- Maximum bucket size (e.g., 10)
local refill_rate = tonumber(ARGV[2])   -- Tokens added per second (e.g., 10 / 60 = 0.1667)
local now = tonumber(ARGV[3])           -- Current timestamp in seconds
local requested = 1                     -- Tokens requested per hit

-- Fetch current bucket state from Redis hash
local data = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(data[1])
local last_refill = tonumber(data[2])

-- Initialize bucket if it doesn't exist yet
if not tokens then
  tokens = capacity
  last_refill = now
else
  -- Calculate tokens accumulated since last request
  local elapsed = math.max(0, now - last_refill)
  local generated = elapsed * refill_rate
  tokens = math.min(capacity, tokens + generated)
  last_refill = now
end

-- Check if enough tokens exist
if tokens >= requested then
  tokens = tokens - requested
  -- Save updated bucket back to Redis
  redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
  -- Expire the key after the time needed to fill from 0 to max capacity
  local ttl = math.ceil(capacity / refill_rate)
  redis.call("EXPIRE", key, ttl)
  
  -- Return: { allowed (1), remaining_tokens, ttl }
  return { 1, math.floor(tokens), ttl }
else
  -- Save state and reject request
  redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
  local ttl = math.ceil((capacity - tokens) / refill_rate)
  redis.call("EXPIRE", key, ttl)
  
  -- Return: { rejected (0), remaining_tokens (0), retry_after_seconds }
  local time_to_next_token = math.ceil((requested - tokens) / refill_rate)
  return { 0, 0, time_to_next_token }
end