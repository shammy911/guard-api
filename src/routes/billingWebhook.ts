import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import crypto from "crypto";
import { redis } from "../utils/redis.js";
import "dotenv/config";
import { alreadyProcessed } from "../services/webhookIdempotency.js";

function verifySignature(payload: string, signature: string) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET!;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

export default async function billingWebhook(app: FastifyInstance) {
  app.post(
    "/webhook",
    { config: { rawBody: true } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const sig = req.headers["x-signature"] as string;
      const raw = (req as any).rawBody as string;

      if (!sig || !raw) {
        return reply.code(400).send({ error: "INVALID_WEBHOOK" });
      }

      if (!verifySignature(raw, sig)) {
        return reply.code(401).send({ error: "BAD_SIGNATURE" });
      }

      const event = JSON.parse(raw);
      const eventId = event.id as string;

      // Idempotency check
      if (await alreadyProcessed(eventId)) {
        // Duplicate webhook -> acknowledge but do nothing
        return reply.send({ received: true, duplicate: true });
      }

      const apiKey = event?.meta?.custom_data?.apiKey;
      if (!apiKey) {
        return reply.send({ received: true });
      }

      switch (event.event_name) {
        case "subscription_created":
        case "subscription_updated": {
          await redis.hset(`api_key:${apiKey}`, {
            plan: "pro",
            enabled: "true",
          });

          await redis.set(`billing:ls_sub:${apiKey}`, event.data.id);
          break;
        }

        case "subscription_cancelled": {
          await redis.hset(`api_key:${apiKey}`, {
            plan: "free",
            enabled: "true",
          });
          break;
        }
      }

      return reply.send({ received: true });
    },
  );
}
