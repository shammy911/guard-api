import "dotenv/config";
import { Redis } from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not defined");
}

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  lazyConnect: false,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("error", (err: Error) => {
  console.error("Redis connection error:", err);
});

redis.on("connect", () => {
  console.log("Redis connected");
});
