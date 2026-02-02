import "dotenv/config";
import Fastify from "fastify";
import checkRoute from "./routes/check.js";
import cors from "@fastify/cors";
import { auth } from "./middleware/auth.js";
import { uptime } from "node:process";

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

app.get("/health", async () => {
  return {
    status: "ok",
    uptime: process.uptime(),
  };
});

app.addHook("preHandler", auth);

app.register(checkRoute, { prefix: "/check" });

app.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" }, () =>
  console.log(`Guard API running on port: ${process.env.PORT || 3000}`),
);
