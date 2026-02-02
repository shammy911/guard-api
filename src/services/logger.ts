import "dotenv/config";
import { redis } from "../utils/redis.js";

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

  const LOG_RETENTION = Number(process.env.LOG_RETENTION || 1000);

  const key = `logs:${data.clientKey}`;

  await redis.lpush(key, JSON.stringify(logEntry));
  await redis.ltrim(key, 0, LOG_RETENTION - 1); // Keep only the latest LOG_RETENTION logs
}
