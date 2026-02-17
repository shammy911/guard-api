import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";
import { redis } from "../utils/redis.js";
import { auth } from "../middleware/auth.js";

export default async function billingPortal(app: FastifyInstance) {
  app.get(
    "/portal",
    { preHandler: [auth, apiKeyGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.apiKey!;
      const store = process.env.LEMON_SQUEEZY_STORE_SLUG;
      const token = process.env.LEMON_SQUEEZY_API_KEY;

      const fallback = store
        ? `https://${store}.lemonsqueezy.com/billing`
        : null;

      const subId = await redis.get(`billing:ls:sub:${apiKey}`);
      if (!subId || !token) {
        if (!fallback)
          return reply.code(500).send({ error: "PORTAL_NOT_CONFIGURED" });
        return { url: fallback, signed: false };
      }

      const res = await fetch(
        `https://api.lemonsqueezy.com/v1/subscriptions/${subId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.api+json",
          },
        },
      );

      if (!res.ok) {
        if (!fallback)
          return reply.code(502).send({ error: "PORTAL_FETCH_FAILED" });
        return { url: fallback, signed: false };
      }

      const json: any = await res.json();
      const signedUrl = json?.data?.attributes?.urls?.customer_portal;

      if (!signedUrl) {
        if (!fallback)
          return reply.code(502).send({ error: "PORTAL_URL_MISSING" });
        return { url: fallback, signed: false };
      }

      return { url: signedUrl, signed: true };
    },
  );
}
