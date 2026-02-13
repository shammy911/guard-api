import crypto from "crypto";
import { redis } from "../utils/redis.js";

function newKid() {
  return `kid_${crypto.randomBytes(8).toString("hex")}`;
}

export function generateApiKey(): string {
  return `guard_${crypto.randomBytes(16).toString("hex")}`;
}

export async function createApiKey(userId: string, name?: string) {
  const apiKey = generateApiKey();
  const kid = newKid();

  // Key metadata (HASH)
  await redis.hset(`api_key:${apiKey}`, {
    kid,
    plan: "free",
    enabled: "true",
    name: (name || "").trim(),
    created_at: Date.now().toString(),
    last_seen: "",
  });

  // Ownership mapping
  await redis.sadd(`user_keys:${userId}`, apiKey);
  await redis.set(`key_owner:${apiKey}`, userId);

  // Safe id -> token mapping (STRING)
  await redis.set(`kid_to_key:${kid}`, apiKey);

  return { apiKey, kid };
}

// export async function disableApiKey(apiKey: string) {
//   await redis.hset(`api_key:${apiKey}`, { enabled: "false" });
// }

export async function disableByKid(kid: string) {
  const apiKey = await redis.get(`kid_to_key:${kid}`);
  if (!apiKey) return { ok: false, error: "KID_NOT_FOUND" as const };

  await redis.hset(`api_key:${apiKey}`, { enabled: "false" });
  return { ok: true };
}

// export async function rotateApiKey(
//   oldKey: string,
//   userId: string,
//   name?: string,
// ) {
//   await disableApiKey(oldKey);
//   return createApiKey(userId, name);
// }

export async function rotateByKid(kid: string, userId: string, name?: string) {
  const oldKey = await redis.get(`kid_to_key:${kid}`);
  if (!oldKey) return { ok: false, error: "KID_NOT_FOUND" as const };

  // Disable old
  await redis.hset(`api_key:${oldKey}`, { enabled: "false" });

  // Create new
  const created = await createApiKey(userId, name);
  return { ok: true, apiKey: created.apiKey, kid: created.kid };
}
