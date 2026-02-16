import type { FastifyInstance, FastifyRequest } from "fastify";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { redis } from "../utils/redis.js";

export default async function billingStatus(app: FastifyInstance) {
  app.get(
    "/status",
    { preHandler: [apiKeyGuard] },
    async (req: FastifyRequest) => {
      const apiKey = req.apiKey!;
      const meta = await redis.hgetall(`api_key:${apiKey}`);
      const subId = await redis.get(`billing:ls:sub:${apiKey}`);

      return {
        plan: meta.plan || "free",
        subscription: {
          active: (meta.plan || "free") !== "free",
          lemonSubscriptionId: subId || null,
        },
      };
    },
  );
}
