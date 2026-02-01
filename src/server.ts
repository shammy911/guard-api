import "dotenv/config";

import Fastify from "fastify";
//import checkRoute from "./routes/check";
import { redis } from "./utils/redis";
import { healthRoute } from "./routes/health";
import { ipRateLimit } from "./guards/ipRateLimit";

const app = Fastify({
  logger: true,
});

// Applying IP rate limiting guard globally
app.register(ipRateLimit, {
  limit: 3, // max 3 requests
  window: 60, // per 60 seconds
});

app.register(healthRoute);

const port = Number(process.env.PORT) || 3000;

// redis.ping().then((res) => {
//   console.log("Redis connected:", res);
// });

app.listen({ port, host: "0.0.0.0" }, () =>
  console.log(`Guard API is running on port ${port}...`),
);
