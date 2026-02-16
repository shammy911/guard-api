import type { FastifyInstance, FastifyRequest } from "fastify";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { redis } from "../utils/redis.js";
import { PLANS } from "../config/plans.js";

export default async function billingStatus(app: FastifyInstance) {
  app.get(
    "/status",
    { preHandler: [apiKeyGuard] },
    async (req: FastifyRequest) => {
      const apiKey = req.apiKey!;
      const meta = await redis.hgetall(`api_key:${apiKey}`);

      const planName = (meta.plan || "free").toLowerCase();
      const limits = PLANS[planName as keyof typeof PLANS] ?? PLANS.free;

      const subId =
        meta.lemon_subscription_id ||
        (await redis.get(`billing:ls:sub:${apiKey}`)) ||
        null;

      const billingStatus =
        meta.billing_status || (planName !== "free" ? "active" : "free");

      return {
        plan: {
          name: planName,
          ...limits, // { rpm, monthly }
        },
        billing: {
          status: billingStatus,
          lemonSubscriptionId: subId,
          active: planName !== "free",
        },
      };
    },
  );
}
