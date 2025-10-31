import Fastify from "fastify";
import dotenv from "dotenv";
import rateLimit from "@fastify/rate-limit";
import Redis from "ioredis";
import crypto from "crypto";

dotenv.config();

const app = Fastify({ logger: false });

const tenantPlans = new Map<string, "free" | "pro" | "enterprise">([
  ["tenant-A", "free"],
  ["tenant-B", "pro"],
  ["tenant-C", "enterprise"],
]);

const getTenantRateLimit = (tenantId: string) => {
  const plan = tenantPlans.get(tenantId) || "free";
  switch (plan) {
    case "enterprise":
      return { max: 100, timeWindow: "10s" };
    case "pro":
      return { max: 20, timeWindow: "10s" };
    default:
      return { max: 5, timeWindow: "10s" };
  }
};

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: +(process.env.REDIS_PORT || 6379),
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

export async function setupApp() {
  await redis.connect();
  console.log(
    "Connected to Redis:",
    process.env.REDIS_HOST,
    process.env.REDIS_PORT
  );

  await app.register(rateLimit, {
    max: 5,
    timeWindow: "10s",
    redis,
    keyGenerator: (req) =>
      (req.headers["x-tenant-id"] as string) || "anonymous",
    global: false,
  });

  const orders: Record<string, any[]> = {};

  app.post("/v1/orders", async (req, reply) => {
    const tenantId = req.headers["x-tenant-id"] as string;
    const idemKey = req.headers["idempotency-key"] as string;
    const body = req.body as { item: string; amount: number };

    if (!tenantId)
      return reply.code(400).send({ error: "Missing X-Tenant-Id" });
    if (!idemKey)
      return reply.code(400).send({ error: "Missing Idempotency-Key" });
    if (!body?.item || typeof body.amount !== "number")
      return reply.code(400).send({ error: "Invalid payload" });

    const redisKey = `idem:${tenantId}:${idemKey}`;
    const cached = await redis.get(redisKey);
    if (cached) return reply.code(200).send(JSON.parse(cached));

    const newOrder = {
      id: crypto.randomUUID(),
      tenantId,
      item: body.item,
      amount: body.amount,
      createdAt: new Date().toISOString(),
    };

    const wasSet = await redis.set(
      redisKey,
      JSON.stringify(newOrder),
      "NX",
      "EX",
      86400
    );

    if (!wasSet) {
      const existing = await redis.get(redisKey);
      return reply.code(200).send(JSON.parse(existing!));
    }

    orders[tenantId] = orders[tenantId] || [];
    orders[tenantId].push(newOrder);

    return reply.code(201).send(newOrder);
  });

  app.get("/v1/orders", async (req, reply) => {
    const tenantId = req.headers["x-tenant-id"] as string;
    if (!tenantId)
      return reply.code(400).send({ error: "Missing X-Tenant-Id" });
    return reply.send(orders[tenantId] || []);
  });

  await app.ready();
  console.log("Fastify ready");
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  setupApp().then(() => {
    app.listen({ port: +port, host: "0.0.0.0" }).then(() => {
      console.log(`🚀 Server listening on http://localhost:${port}`);
    });
  });
}

export { app, redis };
export default app;
