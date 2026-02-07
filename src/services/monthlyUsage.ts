import { redis } from "../utils/redis.js";

export async function getMonthlyUsage(apiKey: string) {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7); // YYYY-MM
  const pattern = `usage:${apiKey}:${ym}-*`;

  let total = 0;
  let cursor = "0";

  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      50,
    );
    cursor = next;

    for (const key of keys) {
      const data = await redis.hgetall(key);
      total += Number(data.allowed || 0);
      total += Number(data.blocked || 0);
    }
  } while (cursor !== "0");

  return total;
}
