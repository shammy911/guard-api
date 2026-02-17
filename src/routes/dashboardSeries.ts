import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { redis } from "../utils/redis.js";
import { auth } from "../middleware/auth.js";

function formatDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastNDays(days: number) {
  const arr: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    arr.push(formatDay(d));
  }
  return arr;
}

export default async function dashboardSeries(app: FastifyInstance) {
  app.get(
    "/dashboard/series",
    { preHandler: [auth, apiKeyGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.apiKey!;
      const days = Math.min(
        30,
        Math.max(7, Number((req.query as any)?.days || 7)),
      );

      const dates = lastNDays(days);

      // Use pipeline for speed
      const pipeline = redis.pipeline();
      for (const day of dates) {
        pipeline.hgetall(`usage:${apiKey}:${day}`);
      }
      const results = await pipeline.exec();

      const series = dates.map((day, idx) => {
        const item = results?.[idx]?.[1] as any;
        const allowed = Number(item?.allowed || 0);
        const blocked = Number(item?.blocked || 0);
        return {
          day,
          allowed,
          blocked,
          total: allowed + blocked,
        };
      });

      return { days, series };
    },
  );
}
