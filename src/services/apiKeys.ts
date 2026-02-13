import crypto from "crypto";
import { redis } from "../utils/redis.js";
import { create } from "domain";

export function generateApiKey(): string {
  return `guard_${crypto.randomBytes(16).toString("hex")}`;
}

export async function createApiKey(userId: string, name?: string) {
  const apiKey = generateApiKey();

  await redis.hset(`api_key:${apiKey}`, {
    plan: "free",
    enabled: "true",
    name: name?.trim() || "",
    created_at: Date.now().toString(),
    last_seen: "",
  });

  await redis.sadd(`user_keys:${userId}`, apiKey);
  await redis.set(`key_owner:${apiKey}`, userId);

  return apiKey;
}

export async function disableApiKey(apiKey: string) {
  await redis.hset(`api_key:${apiKey}`, { enabled: "false" });
}

export async function rotateApiKey(
  oldKey: string,
  userId: string,
  name?: string,
) {
  await disableApiKey(oldKey);
  return createApiKey(userId, name);
}
