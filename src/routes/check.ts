import { rateLimit } from "../services/rateLimiter";
import { recordAbuse } from "../services/abuse";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export default async function (app: FastifyInstance) {
  app.post("/", async (req: FastifyRequest, reply: FastifyReply) => {
    const { ip, route } = req.body;

    const allowed = await rateLimit(ip, route);

    if (!allowed) {
      const score = await recordAbuse(ip);
      return reply.send({
        allowed: false,
        reason: "RATE_LIMIT",
        score,
      });
    }

    reply.send({ allowed: true });
  });
}
