import { redis } from "../utils/redis.js";

function monthPrefix(apiKey: string) {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7); // YYYY-MM
  return `usage:${apiKey}:${ym}`;
}

export async function getMonthlyUsage(apiKey: string) {
  const prefix = monthPrefix(apiKey);

  let allowed = 0;
  let blocked = 0;

  try {
    //SAFE scan (non-blocking) for keys matching the current month
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${prefix}-*`,
        "COUNT",
        50,
      );

      cursor = nextCursor;

      for (const key of keys) {
        const data = await redis.hgetall(key);
        allowed += Number(data.allowed || 0);
        blocked += Number(data.blocked || 0);
      }
    } while (cursor !== "0");
  } catch (error) {
    // analytics must never crash the system
    console.error("Error fetching monthly usage:", error);
  }

  return {
    allowed,
    blocked,
    total: allowed + blocked,
  };
}
