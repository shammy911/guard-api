import { redis } from "../utils/redis.js";

/**
 * Returns true if this webhook event was already processed.
 * Marks the event as processed if not.
 */
export async function alreadyProcessed(eventId: string): Promise<boolean> {
  const key = `billing:webhook:processed:${eventId}`;

  // SETNX = set if not exists
  const wasSet = await redis.setnx(key, 1);

  if (wasSet === 1) {
    // First time -> mark with TTL
    await redis.expire(key, 60 * 60 * 24 * 7); // keep for 7 days
    return false;
  }

  // Already exists -> already processed
  return true;
}
