import type fastify = require("fastify");
import redis = require("../utils/redis");
import process = require("node:process");
import uptime = require("node:process");

export async function healthRoute(app: fastify.FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    try {
      await redis.redis.ping();

      return {
        status: "ok",
        redis: "connected",
        uptime: process.uptime(),
      };
    } catch (error) {
      reply.code(503);
      return {
        status: "error",
        redis: "disconnected",
      };
    }
  });
}
