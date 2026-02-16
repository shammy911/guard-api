import "dotenv/config";
import Fastify from "fastify";
import usageRoute from "./routes/usage.js";
import checkRoute from "./routes/check.js";
import cors from "@fastify/cors";
import billingCheckout from "./routes/billingCheckout.js";
import billingWebhook from "./routes/billingWebhook.js";
import dashboard from "./routes/dashboard.js";
import keys from "./routes/keys.js";
import logs from "./routes/logs.js";
import dashboardSeries from "./routes/dashboardSeries.js";
import billingStatus from "./routes/billingStatus.js";
import billingPortal from "./routes/billingPortal.js";

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
      routes: [
        "/health",
        "/dashboard",
        "/check",
        "/usage",
        "/dashboard",
        "/dashboard/series",
        "/logs",
        "/keys",
        "/billing/checkout",
        "/billing/webhook",
        "/billing/status",
        "/billing/portal",
      ],
    };
  });

  app.addContentTypeParser(
    ["application/json", "application/*+json"],
    { parseAs: "buffer" },
    (req, body, done) => {
      const raw = body.toString("utf8");
      (req as any).rawBody = raw;

      // For webhook: don't fail on JSON parse (signature is validated later)
      if (req.url.startsWith("/billing/webhook")) {
        try {
          // webhook handler expects req.body parsed too, so we still parse
          done(null, raw ? JSON.parse(raw) : {});
        } catch {
          // keep parsed body empty but rawBody still available
          done(null, {});
        }
        return;
      }

      // Normal JSON parsing for all other routes
      try {
        done(null, raw ? JSON.parse(raw) : {});
      } catch (err) {
        done(err as Error);
      }
    },
  );

  // Protected routes (MASTER_KEY required)
  app.register(checkRoute, { prefix: "/check" });
  app.register(usageRoute, { prefix: "/usage" });
  app.register(billingCheckout, { prefix: "/billing" });
  //app.register(billingPortal, { prefix: "/billing" });

  // Lemon Squeezy webhook (NO auth, secured via signature)
  app.register(billingWebhook, { prefix: "/billing" });

  app.register(dashboard);
  app.register(logs);
  app.register(dashboardSeries);

  app.register(keys);
  app.register(billingStatus, { prefix: "/billing" });
  app.register(billingPortal, { prefix: "/billing" });

  const port = Number(process.env.PORT) || 3001;

  await app.listen({ port, host: "0.0.0.0" });
  console.log(
    `Guard API running on port: ${port} in ${process.env.NODE_ENV} mode`,
  );
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
