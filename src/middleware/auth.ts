import type { FastifyReply, FastifyRequest } from "fastify";

export async function auth(req: FastifyRequest, res: FastifyReply) {
  const key = req.headers["x-guard-key"];
  if (!key || key !== process.env.MASTER_KEY) {
    return res.code(401).send({ error: "Unauthorized" });
  }
}
