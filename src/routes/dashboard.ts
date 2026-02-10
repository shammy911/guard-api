import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { PLANS } from "../config/plans.js";
import { redis } from "../utils/redis.js";
import { getMonthlyUsage } from "../services/monthlyUsage.js";

export default async function Dashboard(app: FastifyInstance) {
  app.get(
    "/dashboard",
    { preHandler: [apiKeyGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.apiKey!;
      const planName = req.plan?.planName! || "Free";
      const plan = PLANS[planName as keyof typeof PLANS];

      const today = new Date().toISOString().slice(0, 10);

      const daily = await redis.hgetall(`usage:${apiKey}:${today}`);
      const monthly = await getMonthlyUsage(apiKey);

      const meta = await redis.hgetall(`api_key:${apiKey}`);

      return {
        apiKey,
        plan: planName,
        limits: plan,
        usage: {
          today: {
            allowed: Number(daily.allowed || 0),
            blocked: Number(daily.blocked || 0),
          },
          month: monthly,
        },
        lastSeen: meta.last_seen
          ? new Date(Number(meta.last_seen)).toISOString()
          : null,
      };
    },
  );
}
