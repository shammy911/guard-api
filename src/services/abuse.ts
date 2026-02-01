import { redis } from "../utils/redis";

export async function recordAbuse(ip: string): Promise<number> {
  const key = `abuse:${ip}`;
  const score = await redis.incr(key);

  await redis.expire(key, 3600); // Set TTL of 1 hour

  return score;
}
