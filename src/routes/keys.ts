import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createApiKey,
  disableApiKey,
  rotateApiKey,
} from "../services/apiKeys.js";
import { redis } from "../utils/redis.js";

function mask(apiKey: string) {
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
}

export default async function keys(app: FastifyInstance) {
  // List API keys for a user
  app.get("/keys", async (req: FastifyRequest) => {
    const { userId } = req.query as { userId: string };
    if (!userId) return { keys: [] };

    const apiKeys = await redis.smembers(`user_keys:${userId}`);

    const items = await Promise.all(
      apiKeys.map(async (k) => {
        const meta = await redis.hgetall(`api_key:${k}`);
        return {
          apiKeysMasked: mask(k),
          apiKeyPrefix: k.slice(0, 9), // "guard_" + 5 chars
          enabled: meta.enabled === "false",
          plan: meta.plan || "free",
          name: meta.name || "",
          // createdAt: meta.created_at
          //   ? new Date(parseInt(meta.created_at))
          //   : null,
          // lastSeen: meta.last_seen ? new Date(parseInt(meta.last_seen)) : null,
          createdAt: meta.created_at ? Number(meta.created_at) : null,
          lastSeen: meta.last_seen ? Number(meta.last_seen) : null,
        };
      }),
    );

    // sort newest first
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return { keys: items };
  });

  // Create a new API key for a user
  app.post("/keys", async (req: FastifyRequest) => {
    const { userId, name } = req.body as { userId: string; name?: string };
    const apiKey = await createApiKey(userId, name);
    return { apiKey };
  });

  app.post("/keys/:key/disable", async (req: FastifyRequest) => {
    const { key } = req.params as { key: string };
    await disableApiKey(key);
    return { success: true };
  });

  app.post("/keys/:key/rotate", async (req: FastifyRequest) => {
    const { key } = req.params as { key: string };
    const { userId, name } = req.body as { userId: string; name?: string };
    const newKey = await rotateApiKey(key, userId, name);
    return { apiKey: newKey };
  });
}
