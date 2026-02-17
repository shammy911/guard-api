import type { FastifyInstance, FastifyRequest } from "fastify";
import { redis } from "../utils/redis.js";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { auth } from "../middleware/auth.js";

export default async function logs(app: FastifyInstance) {
  app.get(
    "/logs",
    { preHandler: [auth, apiKeyGuard] },
    async (req: FastifyRequest) => {
      const apiKey = req.apiKey!;
      const q = req.query as { limit?: string };

      const limit = Math.min(Number(q.limit || 20), 200);
      const key = `logs:${apiKey}`;

      const entries = await redis.lrange(key, 0, limit - 1);
      return entries.map((e) => {
        try {
          return JSON.parse(e);
        } catch {
          return { raw: e };
        }
      });
    },
  );
}
