import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";

export default async function billingCheckout(app: FastifyInstance) {
  app.post(
    "/checkout",
    { preHandler: [apiKeyGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.apiKey!;

      const buyId = process.env.LEMON_SQUEEZY_VARIANT_BUY_ID || "817449"; // move to env
      const base = `https://checkout.lemonsqueezy.com/buy/${buyId}`;

      // Add custom metadata (comes back in webhook)
      const qs = new URLSearchParams();
      qs.set("checkout[custom][apiKey]", apiKey); // <- used by webhook
      qs.set("checkout[custom][plan]", "pro"); // <- optional but useful
      qs.set("checkout[custom][source]", "guard-web"); // <- optional
      qs.set("checkout[custom][ts]", Date.now().toString()); // <- optional

      // Optional: if you want to prefill email (only if you actually have it)
      // qs.set("checkout[email]", "user@example.com");

      const checkoutUrl = `${base}?${qs.toString()}`;

      return reply.send({ url: checkoutUrl });
    },
  );
}
