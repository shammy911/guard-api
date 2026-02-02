import "dotenv/config";
import { redis } from "../utils/redis";

export async function rateLimit(
  ip: string,
  route: string,
  limit = Number(process.env.RATE_LIMIT_MAX || 10),
  windowSeconds = Number(process.env.RATE_LIMIT_WINDOW || 60),
): Promise<boolean> {
  const key = `rl:${ip}:${route}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, windowSeconds); // Set TTL of windowSeconds
  }

  return count <= limit;
}
