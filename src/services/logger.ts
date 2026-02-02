import { redis } from "../utils/redis";

export async function logDecision(data: {
  clientKey: string;
  ip: string;
  route: string;
  allowed: boolean;
  reason?: string;
}) {
  const logEntry = {
    ...data,
    timestamp: Date.now(),
  };

  const key = `logs:${data.clientKey}`;

  await redis.lpush(key, JSON.stringify(logEntry));
  await redis.ltrim(key, 0, 999); // Keep only the latest 1000 logs
}
