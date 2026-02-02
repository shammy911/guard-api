import "dotenv/config";
import type { FastifyReply, FastifyRequest } from "fastify";

export async function auth(req: FastifyRequest, reply: FastifyReply) {
  const key = req.headers["x-guard-key"];

  //Debugging
  //console.log("HEADER KEY:", key);
  //console.log("MASTER KEY:", process.env.MASTER_KEY);

  if (!key || key !== process.env.MASTER_KEY) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  if (!key.startsWith("guard_")) {
    return reply.code(401).send({ error: "INVALID_KEY" });
  }

  if (key !== process.env.MASTER_KEY) {
    return reply.code(401).send({ error: "KEY_MISMATCH" });
  }
}
