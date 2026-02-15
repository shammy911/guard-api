import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { PLANS } from "../config/plans.js";
import { redis } from "../utils/redis.js";
import { getMonthlyUsage } from "../services/monthlyUsage.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function Dashboard(app: FastifyInstance) {
  app.get(
    "/dashboard",
    { preHandler: [apiKeyGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.apiKey!;
      const planName = req.plan?.planName! || "Free";
      const plan = PLANS[planName.toLowerCase() as keyof typeof PLANS];

      const planKey = planName.toLowerCase() as keyof typeof PLANS;
      const limits = PLANS[planKey] ?? PLANS.free;

      const day = todayISO();

      // Usage
      const daily = await redis.hgetall(`usage:${apiKey}:${day}`);
      const allowed = Number(daily.allowed || 0);
      const blocked = Number(daily.blocked || 0);
      const total = allowed + blocked;

      const monthlyUsed = await getMonthlyUsage(apiKey);

      // Key meta
      const meta = await redis.hgetall(`api_key:${apiKey}`);
      const lastSeenTs = meta.last_seen ? Number(meta.last_seen) : null;

      // Recent logs (latest 10)
      // logger.ts typically uses a LIST like logs:<apiKey>
      let recent: Array<{
        ts: number;
        method?: string;
        route?: string;
        ip?: string;
        allowed: boolean;
        reason?: string;
      }> = [];

      try {
        const raw = await redis.lrange(`logs:${apiKey}`, 0, 9);
        recent = raw
          .map((s) => {
            try {
              return JSON.parse(s);
            } catch {
              return null;
            }
          })
          .filter(Boolean)
          .map((x: any) => ({
            ts: Number(x.ts || x.time || Date.now()),
            method: x.method,
            route: x.route,
            ip: x.ip,
            allowed: Boolean(x.allowed),
            reason: x.reason,
          }));
      } catch {
        // don’t fail dashboard if logs unavailable
      }

      return {
        plan: {
          name: planName,
          rpm: limits.rpm,
          monthly: limits.monthly,
        },
        today: {
          allowed,
          blocked,
          total,
        },
        month: {
          used: monthlyUsed,
          limit: limits.monthly,
          remaining: Math.max(0, limits.monthly - monthlyUsed),
        },
        lastSeen: {
          ts: lastSeenTs,
          route: recent?.[0]?.route || null, // best effort
        },
        recent,
      };
    },
  );
}
