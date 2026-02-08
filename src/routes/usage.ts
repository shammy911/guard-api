import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getMonthlyUsage } from "../services/usageReader.js";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { auth } from "../middleware/auth.js";

export default async function (app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [auth, apiKeyGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.apiKey!; // Set by apiKeyGuard middleware
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
