import Fastify from "fastify";
import checkRoute from "./routes/check";

const app = Fastify();

app.register(checkRoute, { prefix: "/check" });

app.listen({ port: 3000 }, () => console.log("Guard API running"));
