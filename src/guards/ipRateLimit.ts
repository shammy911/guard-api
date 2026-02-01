import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { redis } from "../utils/redis";

interface RateLimitOptions {
  limit: number;
  window: number; // in seconds
}

export async function ipRateLimit(
  app: FastifyInstance,
  options: RateLimitOptions,
) {
  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ip = request.ip;

      console.log("Request IP: ", ip);

      const key = `rl:ip:${ip}`;
      //const current = await redis.incr(key);

      // increment + expire atomically
      const [[, current]] = await redis
        .multi()
        .incr(key)
        .expire(key, options.window, "NX")
        .exec();

      console.log(`Key: ${key}, Count: ${current}`);

      //   if (current === 1) {
      //     await redis.expire(key, options.window);
      //   }

      const remaining = Math.max(options.limit - current, 0);

      reply.header("X-RateLimit-Limit", options.limit);
      reply.header("X-RateLimit-Remaining", remaining);

      if (current > options.limit) {
        reply.code(429);
        reply.header("Retry-After", options.window);

        return reply.send({
          error: "Too Many Requests",
          message: `Rate limit exceeded. Try again in ${options.window} seconds.`,
        });
      }
    },
  );
}
