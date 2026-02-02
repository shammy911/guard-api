import "dotenv/config";
import Fastify from "fastify";
import checkRoute from "./routes/check";

const app = Fastify();

app.register(checkRoute, { prefix: "/check" });

app.listen({ port: Number(process.env.PORT) || 3000 }, () =>
  console.log(`Guard API running on port: ${process.env.PORT || 3000}`),
);
