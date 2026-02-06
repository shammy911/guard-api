import "dotenv/config";
import Fastify from "fastify";
import usageRoute from "./routes/usage.js";
import checkRoute from "./routes/check.js";
import cors from "@fastify/cors";
import { auth } from "./middleware/auth.js";

async function start() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required");
  }

  if (!process.env.MASTER_KEY) {
    throw new Error("MASTER_KEY is required");
  }

  const app = Fastify({
    trustProxy: true,
  });

  await app.register(cors, { origin: false });

  // Public health check endpoint
  app.get("/health", async () => {
    return {
      status: "ok",
      uptime: process.uptime(),
    };
  });

  app.addHook("preHandler", async (req, reply) => {
    // Skip auth for health check
    if (req.url === "/health") return;
    await auth(req, reply);
  });

  app.register(usageRoute, { prefix: "/usage" });
  app.register(checkRoute, { prefix: "/check" });

  const port = Number(process.env.PORT) || 3000;

  await app.listen({ port, host: "0.0.0.0" });
  console.log(
    `Guard API running on port: ${port} in ${process.env.NODE_ENV} mode`,
  );
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
