import "dotenv/config";
import { rateLimit } from "../services/rateLimiter.js";
import { recordAbuse } from "../services/abuse.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { logDecision } from "../services/logger.js";
import { redis } from "../utils/redis.js";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { recordUsage } from "../services/usage.js";
import { checkKeyLimits } from "../services/keyLimiter.js";
import { getMonthlyUsage } from "../services/monthlyUsage.js";

function normalizeIp(ip: string) {
  return ip === "::1" ? "127.0.0.1" : ip; // localhost fix
}

export default async function (app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [apiKeyGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const clientKey = req.apiKey!; // Set by apiKeyGuard middleware

      //Guard Self rate limiting service
      try {
        const selfKey = `self_rl:${clientKey}`;
        const selfCount = await redis.incr(selfKey);
        if (selfCount === 1) {
          await redis.expire(selfKey, 60); // 1 minute window
        }
        if (selfCount > Number(process.env.SELF_RATE_LIMIT || 60)) {
          return reply.code(429).send({
            allowed: false,
            reason: "GUARD_RATE_LIMIT",
          });
        }
      } catch (error) {
        return reply.code(503).send({
          allowed: false,
          reason: "SERVICE_UNAVAILABLE",
        });
      }

      // IP Normalization and Route Extraction with basic validation
      let ip = normalizeIp(req.ip);
      const body = req.body as { route?: string };
      if (!body?.route || typeof body.route !== "string") {
        return reply.code(400).send({ error: "ROUTE_REQUIRED" });
      }

      // Monthly quota enforcement
      try {
        const used = await getMonthlyUsage(clientKey);
        const limit = req.plan!.monthly;

        if (used >= limit) {
          return reply.code(200).send({
            allowed: false,
            reason: "MONTHLY_QUOTA_EXCEEDED",
          });
        }
      } catch {
        // Fail closed OR fail open?
        // Product decision: fail closed is safer
        return reply.code(503).send({
          allowed: false,
          reason: "SERVICE_UNAVAILABLE",
        });
      }

      const route = body.route;

      // Rate limit decision
      let allowed = false;
      try {
        allowed = await Promise.race([
          rateLimit(ip, route, req.plan!.rpm),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 300),
          ),
        ]);
      } catch (error) {
        return reply.code(503).send({
          allowed: false,
        });
      }

      // USAGE TRACKING

      try {
        await recordUsage(clientKey, allowed);
        // last_seen belongs to the API key metadata
        await redis.hset(`api_key:${clientKey}`, {
          last_seen: Date.now().toString(),
        });
      } catch {
        // analytics must never affect decision
      }

      // Decision Handling
      if (!allowed) {
        try {
          await recordAbuse(ip);
          await logDecision({
            clientKey,
            ip,
            route,
            allowed: false,
            reason: "RATE_LIMIT",
          });
        } catch (err) {
          // even logging failure should not crash
        }

        return reply.code(429).send({
          allowed: false,
        });
      }

      // Allowed Path
      try {
        await logDecision({
          clientKey,
          ip,
          route,
          allowed: true,
        });
      } catch (err) {
        // silent failure
      }

      return reply.send({ allowed: true });
    },
  );
}
