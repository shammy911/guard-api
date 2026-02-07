import { redis } from "../utils/redis.js";

const KEY_RPM_LIMIT = 120; // Requests per minute
const BURST_LIMIT = 10; // Max burst requests
const BURST_WINDOW = 2; // Burst window in seconds

export async function checkKeyLimits(apiKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const minute = Math.floor(now / 60);

  const rateKey = `key_rl:${apiKey}:${minute}`;
  const burstKey = `burst:${apiKey}`;

  try {
    // Minute rate limit
    const rateCount = await redis.incr(rateKey);
    if (rateCount === 1) {
      await redis.expire(rateKey, 60);
    }

    if (rateCount > KEY_RPM_LIMIT) {
      return {
        allowed: false,
        reason: "KEY_RATE_LIMIT",
      };
    }

    // Burst Protection
    const burstCount = await redis.incr(burstKey);
    if (burstCount === 1) {
      await redis.expire(burstKey, BURST_WINDOW);
    }

    if (burstCount > BURST_LIMIT) {
      return {
        allowed: false,
        reason: "BURST_LIMIT",
      };
    }

    return {
      allowed: true,
    };
  } catch (error) {
    // FAIL CLOSED
    return {
      allowed: false,
      reason: "SERVICE_UNAVAILABLE",
    };
  }
}
