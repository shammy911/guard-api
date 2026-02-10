import "dotenv/config";
import Fastify from "fastify";
import usageRoute from "./routes/usage.js";
import checkRoute from "./routes/check.js";
import cors from "@fastify/cors";
import billingCheckout from "./routes/billingCheckout.js";
import billingWebhook from "./routes/billingWebhook.js";
import dashboard from "./routes/dashboard.js";
import dashboardData from "./routes/dashboardData.js";
import keys from "./routes/keys.js";

async function start() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required");
  }

  if (!process.env.MASTER_KEY) {
    throw new Error("MASTER_KEY is required");
  }

  const app = Fastify({
    trustProxy: true,
    // so we can get rawBody for webhooks
    bodyLimit: 1048576, // 1MB, adjust as needed
  });

  await app.register(cors, { origin: false });

  // Public health check endpoint
  app.get("/health", async () => {
    return {
      status: "ok",
      uptime: process.uptime(),
    };
  });

  app.get("/", async () => {
    return {
      status: "ok",
      routes: ["/health", "/dashboard", "/check", "/usage"],
    };
  });

  // Protected routes (MASTER_KEY required)
  app.register(checkRoute, { prefix: "/check" });
  app.register(usageRoute, { prefix: "/usage" });
  app.register(billingCheckout, { prefix: "/billing" });
  //app.register(billingPortal, { prefix: "/billing" });

  // Stripe webhook (NO auth, secured via signature)
  app.register(billingWebhook, { prefix: "/billing" });

  app.register(dashboard, { prefix: "/dashboard" });
  app.register(dashboardData, { prefix: "/dashboard" });

  app.register(keys, { prefix: "/keys" });

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
