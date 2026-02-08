import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { getMonthlyUsage } from "../services/monthlyUsage.js";
import { redis } from "../utils/redis.js";

export default async function dashboardData(app: FastifyInstance) {
  app.get(
    "/data",
    { preHandler: [apiKeyGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.apiKey!;
      const plan = req.plan!;

      const monthly = await getMonthlyUsage(apiKey);

      const today = new Date().toISOString().slice(0, 10);
      const daily = await redis.hgetall(`usage:${apiKey}:${today}`);

      return reply.send({
        apiKey,
        plan: req.plan?.planName || "Unknown",
        limits: {
          rpm: plan.rpm,
          monthly: plan.monthly,
        },
        usage: {
          today: {
            allowed: Number(daily.allowed || 0),
            blocked: Number(daily.blocked || 0),
          },
          month: monthly,
        },
      });
    },
  );
}
