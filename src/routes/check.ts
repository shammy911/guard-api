import { rateLimit } from "../services/rateLimiter";
import { recordAbuse } from "../services/abuse";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../middleware/auth";
import { logDecision } from "../services/logger";

export default async function (app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: auth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { ip, route } = req.body as { ip: string; route: string };

      const clientKey = req.headers["x-api-key"] as string;

      // Rate limit decision
      const allowed = await rateLimit(ip, route);

      if (!allowed) {
        const abuseScore = await recordAbuse(ip);

        await logDecision({
          clientKey,
          ip,
          route,
          allowed: false,
          reason: "RATE_LIMIT",
        });

        return reply.send({
          allowed: false,
          reason: "RATE_LIMIT",
          abuseScore,
        });
      }

      // Allowed Request
      await logDecision({
        clientKey,
        ip,
        route,
        allowed: true,
      });

      return reply.send({ allowed: true });
    },
  );
}
