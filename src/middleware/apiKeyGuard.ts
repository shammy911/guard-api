import type { FastifyReply, FastifyRequest } from "fastify";
import { redis } from "../utils/redis.js";
import { PLANS } from "../config/plans.js";

export async function apiKeyGuard(req: FastifyRequest, reply: FastifyReply) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return reply.code(401).send({ error: "API_KEY_REQUIRED" });
  }

  const data = await redis.hgetall(`api_key:${apiKey}`);

  if (!data || Object.keys(data).length === 0) {
    return reply.code(401).send({ error: "INVALID_API_KEY" });
  }

  if (data.enabled !== "true") {
    return reply.code(403).send({ error: "API_KEY_DISABLED" });
  }

  req.apiKey = apiKey;
  req.plan = PLANS[data.plan as keyof typeof PLANS];
}
