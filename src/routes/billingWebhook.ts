import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { redis } from "../utils/redis.js";

/**
 * Expectation:
 * - server.ts stores raw JSON string in (req as any).rawBody using a content-type parser.
 * - Lemon Squeezy sends signature header (commonly "x-signature" or "X-Signature")
 * - You configured env: LEMON_SQUEEZY_WEBHOOK_SECRET
 *
 * We implement:
 * - Signature verification (HMAC SHA-256)
 * - Idempotency guard (event id)
 * - Plan upgrade/downgrade using Redis
 */

type AnyObj = Record<string, any>;

function pick(obj: AnyObj, paths: string[]) {
  for (const p of paths) {
    const v = p
      .split(".")
      .reduce((acc: any, k: string) => (acc ? acc[k] : undefined), obj);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function safeJsonParse(raw: string): AnyObj | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function timingSafeEqualHex(aHex: string, bHex: string) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifySignature(rawBody: string, signature: string, secret: string) {
  // Lemon-style HMAC SHA-256 hex digest
  const h = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  return timingSafeEqualHex(h, signature);
}

function normalizeEventName(name: string) {
  return (name || "").toLowerCase().trim();
}

function derivePlanFromEvent(event: AnyObj): "free" | "pro" {
  // Prefer explicit custom_data.plan if you set it in checkout
  const plan =
    pick(event, [
      "meta.custom_data.plan",
      "meta.custom_data.targetPlan",
      "meta.custom.plan",
      "custom_data.plan",
    ]) || "";

  const p = String(plan).toLowerCase();
  if (p === "pro") return "pro";
  return "pro"; // default: any successful paid event upgrades to pro for v1
}

function shouldActivate(eventName: string, event: AnyObj) {
  // Lemon event names vary depending on integration:
  // subscription_created / subscription_updated / subscription_payment_successful / order_created etc.
  // We treat these as "activate" signals:
  if (
    eventName.includes("subscription_created") ||
    eventName.includes("subscription_payment") ||
    eventName.includes("order_created") ||
    eventName.includes("payment_success")
  ) {
    return true;
  }

  // Also: if subscription updated and status becomes active
  const status = String(
    pick(event, [
      "data.attributes.status",
      "data.attributes.status_formatted",
      "data.status",
    ]) || "",
  ).toLowerCase();

  if (
    eventName.includes("subscription_updated") &&
    (status === "active" || status === "on_trial")
  ) {
    return true;
  }

  return false;
}

function shouldDeactivate(eventName: string, event: AnyObj) {
  if (
    eventName.includes("subscription_cancelled") ||
    eventName.includes("subscription_expired") ||
    eventName.includes("subscription_paused")
  ) {
    return true;
  }

  const status = String(
    pick(event, ["data.attributes.status", "data.status"]) || "",
  ).toLowerCase();
  if (
    eventName.includes("subscription_updated") &&
    (status === "cancelled" || status === "expired")
  ) {
    return true;
  }

  return false;
}

export default async function billingWebhook(app: FastifyInstance) {
  app.post(
    "/webhook",
    // IMPORTANT: do NOT put auth middleware here; webhook is secured by signature
    async (req: FastifyRequest, reply: FastifyReply) => {
      const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
      if (!secret) {
        return reply
          .code(500)
          .send({ error: "LEMON_SQUEEZY_WEBHOOK_SECRET_MISSING" });
      }

      // Signature header (some setups send x-signature / X-Signature)
      const signature =
        (req.headers["x-signature"] as string) ||
        (req.headers["X-Signature"] as string) ||
        "";

      if (!signature) {
        return reply.code(400).send({ error: "SIGNATURE_REQUIRED" });
      }

      // raw body (required for signature verification)
      const rawBody = (req as any).rawBody as string | undefined;
      if (!rawBody) {
        // fallback (not ideal): reconstruct raw JSON from parsed body
        // Signature verification may fail if spacing/order differs, so we fail safely.
        return reply.code(400).send({ error: "RAW_BODY_REQUIRED" });
      }

      if (!verifySignature(rawBody, signature, secret)) {
        return reply.code(401).send({ error: "INVALID_SIGNATURE" });
      }

      const event = safeJsonParse(rawBody);
      if (!event) {
        return reply.code(400).send({ error: "INVALID_JSON" });
      }

      const eventName = normalizeEventName(
        String(pick(event, ["meta.event_name", "event_name"]) || ""),
      );

      // Idempotency key: event id
      const eventId =
        String(
          pick(event, ["meta.event_id", "meta.id", "data.id", "id"]) || "",
        ) || crypto.createHash("sha1").update(rawBody).digest("hex"); // fallback hash if no ID present

      const idemKey = `billing:ls:webhook:${eventId}`;

      // Idempotency: if already processed, return OK immediately
      const firstTime = await redis.set(idemKey, "1", "EX", 60 * 60 * 24, "NX");
      if (firstTime !== "OK") {
        return reply.send({ received: true, deduped: true });
      }

      // Identify which apiKey this purchase belongs to.
      // You should be passing this via checkout custom_data (recommended).
      const apiKey =
        (pick(event, [
          "meta.custom_data.apiKey",
          "meta.custom_data.api_key",
          "meta.custom.apiKey",
          "custom_data.apiKey",
        ]) as string) || "";

      if (!apiKey) {
        // Can't apply billing without knowing which key to upgrade.
        // Keep idempotency key set (so it doesn't retry-loop forever) and respond 200.
        return reply.send({
          received: true,
          warning: "MISSING_API_KEY_METADATA",
        });
      }

      // Optional: subscription/order id
      const subscriptionId = String(
        pick(event, [
          "data.id",
          "data.attributes.subscription_id",
          "data.attributes.order_id",
        ]) || "",
      );

      // Decide activate/deactivate
      const activate = shouldActivate(eventName, event);
      const deactivate = shouldDeactivate(eventName, event);

      // Apply changes to Redis (keep it minimal for v1)
      try {
        if (activate) {
          const plan = derivePlanFromEvent(event);
          await redis.hset(`api_key:${apiKey}`, {
            plan,
            billing_status: "active",
            lemon_subscription_id: subscriptionId || "",
            updatedAt: Date.now().toString(),
          });

          // convenient lookup from apiKey to sub id
          if (subscriptionId) {
            await redis.set(`billing:ls:sub:${apiKey}`, subscriptionId);
          }
        } else if (deactivate) {
          await redis.hset(`api_key:${apiKey}`, {
            plan: "free",
            billing_status: "canceled",
            updatedAt: Date.now().toString(),
          });
        } else {
          // For other events, store minimal metadata (optional)
          await redis.hset(`api_key:${apiKey}`, {
            last_billing_event: eventName || "unknown",
            updatedAt: Date.now().toString(),
          });
        }
      } catch (err) {
        // If Redis fails, you might want to allow provider to retry:
        // But since we already set idempotency, retries won't happen.
        // For v1, we prefer stability over retry loops.
        return reply.code(503).send({ error: "BILLING_UPDATE_FAILED" });
      }

      return reply.send({ received: true });
    },
  );
}
