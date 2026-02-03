import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    apiKey?: string;
    plan?: {
      rpm: number;
    };
  }
}
