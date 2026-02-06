import { redis } from "../utils/redis.js";

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function recordUsage(apiKey: string, allowed: boolean) {
  const dateKey = today();
  const usageKey = `usage:${apiKey}:${dateKey}`;

  try {
    if (allowed) {
      await redis.hincrby(usageKey, "allowed", 1); // Increment allowed count
    } else {
      await redis.hincrby(usageKey, "blocked", 1); // Increment blocked count
    }

    await redis.set(`usage:last_seen:${apiKey}`, Date.now().toString());
  } catch (error) {
    // Usage tracking mut never block the main request flow, so we catch and log any errors without throwing
    console.error("Error recording usage:", error);
  }
}
