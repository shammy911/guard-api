import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { recordAbuse } from "../services/abuse";
import { rateLimit } from "../services/rateLimiter";
import { auth } from "../middleware/auth";
import { redis } from "../utils/redis";

interface CheckBody {
  ip: string;
  route: string;
}

export default async function (app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: auth },
    async (req: FastifyRequest<{ Body: CheckBody }>, reply: FastifyReply) => {
      try {
        // Self-rate-limit to prevent abuse of this endpoint
        const apiKey = req.headers["x-api-key"] as string;
        const selfKey = `self:${apiKey}`;
        const selfCount = await redis.incr(selfKey);
        if (selfCount === 1) {
          await redis.expire(selfKey, 60); // 60 second window
        }

        if (selfCount > 1000) {
          return reply
            .code(429)
            .send({ allowed: false, reason: "SERVICE_RATE_LIMIT" });
        }

        //Extract IP safely
        const clientIp =
          req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip;
        const { route } = req.body;

        //Input validation
        if (
          typeof clientIp !== "string" ||
          typeof route !== "string" ||
          clientIp.length > 45 ||
          route.length > 200
        ) {
          return reply.code(400).send({
            allowed: false,
            reason: "INVALID_INPUT",
          });
        }

        //Rate limiting
        const allowed = await rateLimit(clientIp, route);
        if (!allowed) {
          const score = await recordAbuse(clientIp);

          return reply.code(429).send({
            allowed: false,
            reason: "RATE_LIMIT",
            retryAfter: 60,
            abuseScore: score,
          });
        }

        // Allowed
        return reply.send({
          allowed: true,
        });
      } catch (error) {
        // Fail open on infrastructure errors
        req.log.error(error);
        return reply.send({ allowed: true });
      }
    },
  );
}
