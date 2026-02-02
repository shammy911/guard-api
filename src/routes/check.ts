import { rateLimit } from "../services/rateLimiter";
import { recordAbuse } from "../services/abuse";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../middleware/auth";
import { logDecision } from "../services/logger";
import { redis } from "../utils/redis";

export default async function (app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: auth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      //const { ip, route } = req.body as { ip: string; route: string };

      const clientKey = req.headers["x-api-key"] as string;

      // Self rate limiting
      try {
        const selfKey = `self_rl:${clientKey}`;
        const selfCount = await redis.incr(selfKey);
        if (selfCount === 1) {
          await redis.expire(selfKey, 60); // 1 minute window
        }
        if (selfCount > 60) {
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

      //Trusted IP only
      const ip = req.ip;
      const route = req.body as string;

      // Rate limit decision
      let allowed = false;
      try {
        allowed = await Promise.race([
          rateLimit(ip, route),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 100),
          ),
        ]);
      } catch (error) {
        return reply.code(503).send({
          allowed: false,
        });
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
