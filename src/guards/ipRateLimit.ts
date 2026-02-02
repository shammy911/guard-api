import fp from "fastify-plugin";
import {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginAsync,
} from "fastify";
import { redis } from "../utils/redis";

interface RateLimitOptions {
  limit: number;
  window: number; // in seconds
}

const ipRateLimit: FastifyPluginAsync<RateLimitOptions> = fp(
  async (app: FastifyInstance, options: RateLimitOptions) => {
    console.log("🔧 Registering IP Rate Limit plugin...");

    app.addHook(
      "onRequest",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const ip = request.ip;

        console.log("🔍 Request IP: ", ip);

        const key = `rl:ip:${ip}`;
        const current = Number(await redis.incr(key));

        if (current === 1) {
          await redis.expire(key, options.window);
        }

        console.log(
          `📊 Key: ${key}, Count: ${current}, Limit: ${options.limit}`,
        );

        const remaining = Math.max(options.limit - current, 0);

        reply.header("X-RateLimit-Limit", options.limit);
        reply.header("X-RateLimit-Remaining", remaining);

        if (current > options.limit) {
          console.log(`❌ Rate limit exceeded for ${ip}`);
          reply.code(429);
          reply.header("Retry-After", options.window);

          return reply.send({
            error: "Too Many Requests",
            message: `Rate limit exceeded. Try again in ${options.window} seconds.`,
          });
        }
      },
    );

    console.log("✅ IP Rate Limit plugin registered");
  },
);

export default ipRateLimit;
