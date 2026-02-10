import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createApiKey,
  disableApiKey,
  rotateApiKey,
} from "../services/apiKeys.js";

export default async function keys(app: FastifyInstance) {
  app.post("/keys", async (req: FastifyRequest) => {
    const { userId } = req.body as { userId: string };
    const apiKey = await createApiKey(userId);
    return { apiKey };
  });

  app.post("/keys/:key/disable", async (req: FastifyRequest) => {
    const { key } = req.params as { key: string };
    await disableApiKey(key);
    return { success: true };
  });

  app.post("/keys/:key/rotate", async (req: FastifyRequest) => {
    const { key } = req.params as { key: string };
    const { userId } = req.body as { userId: string };
    const newKey = await rotateApiKey(key, userId);
    return { apiKey: newKey };
  });
}
