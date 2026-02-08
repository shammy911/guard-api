import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    apiKey?: string;
    plan?: {
      planName: string;
      rpm: number;
      monthly: number;
    };
  }
}
