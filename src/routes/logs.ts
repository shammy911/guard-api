import type { FastifyInstance, FastifyRequest } from "fastify";
import { redis } from "../utils/redis.js";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";

export default async function logs(app: FastifyInstance) {
  app.get(
    "/logs",
    { preHandler: [apiKeyGuard] },
    async (req: FastifyRequest) => {
      const apiKey = req.apiKey!;
      const limit = Number((req.query as any).limit || 20);

      const key = `logs:${apiKey}`;
      const entries = await redis.lrange(key, 0, limit - 1);

      return entries.map((e) => JSON.parse(e));
    },
  );
}
