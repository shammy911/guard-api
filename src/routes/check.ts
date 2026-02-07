import "dotenv/config";
import { rateLimit } from "../services/rateLimiter.js";
import { recordAbuse } from "../services/abuse.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { logDecision } from "../services/logger.js";
import { redis } from "../utils/redis.js";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { recordUsage } from "../services/usage.js";
import { checkKeyLimits } from "../services/keyLimiter.js";

export default async function (app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [apiKeyGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const SELF_LIMIT = Number(process.env.SELF_RATE_LIMIT || 60);

      //const clientKey = req.headers["x-api-key"] as string;
      const clientKey = req.apiKey!; // Set by apiKeyGuard middleware

      // Self rate limiting
      try {
        const selfKey = `self_rl:${clientKey}`;
        const selfCount = await redis.incr(selfKey);
        if (selfCount === 1) {
          await redis.expire(selfKey, 60); // 1 minute window
        }
        if (selfCount > SELF_LIMIT) {
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

      // // ---- API key limits (NEW) ----
      // const keyDecision = await checkKeyLimits(clientKey);
      // if (!keyDecision.allowed) {
      //   await redis.incr(`usage:${clientKey}:blocked`);
      //   return reply.code(429).send(keyDecision);
      // }

      //Trusted IP only
      let ip = req.ip;
      if (ip === "::1") ip = "127.0.0.1"; // localhost fix
      const body = req.body as { route?: string };
      if (!body?.route || typeof body.route !== "string") {
        return reply.code(400).send({ error: "ROUTE_REQUIRED" });
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

        // PHASE 1 FIX:
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
