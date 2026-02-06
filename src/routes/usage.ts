import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../middleware/auth.js";
import { getMonthlyUsage } from "../services/usageReader.js";

export default async function (app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: auth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.headers["x-guard-key"] as string;
      if (!apiKey) {
        return reply.code(400).send({
          error: "MISSING_API_KEY",
        });
      }

      const usage = await getMonthlyUsage(apiKey);

      return reply.send({
        apiKey,
        usage,
      });
    },
  );
}
