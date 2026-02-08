import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { apiKeyGuard } from "../middleware/apiKeyGuard.js";

export default async function billingCheckout(app: FastifyInstance) {
  app.post(
    "/checkout",
    { preHandler: [apiKeyGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.apiKey!;

      // Replace with your actual product checkout URL
      const checkoutUrl = `https://checkout.lemonsqueezy.com/buy/817449?checkout[custom][apiKey]=${apiKey}`;

      return reply.send({ url: checkoutUrl });
    },
  );
}
