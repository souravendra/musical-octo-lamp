import { test, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { app, setupApp, redis } from "../src/app";

beforeAll(async () => {
  await setupApp();
  await redis.flushall();
  vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });
});

afterAll(async () => {
  await redis.quit();
  await app.close();
});

test("idempotency key ensures identical order response and persistence", async () => {
  const tenant = "tenant-C";
  const auth = "Bearer ABCD_1234";
  const idemKey = "idem-001";
  const body = { item: "Feed", amount: 100 };

  // 1️⃣ First request
  const first = await request(app.server)
    .post("/v1/orders")
    .set("X-Tenant-Id", tenant)
    .set("Authorization", auth)
    .set("Idempotency-Key", idemKey)
    .send(body);

  expect(first.status).toBe(201);
  expect(first.body).toHaveProperty("id");
  expect(first.body).toMatchObject({
    tenantId: tenant,
    item: "Feed",
    amount: 100,
  });

  // 2️⃣ Repeat same request
  const second = await request(app.server)
    .post("/v1/orders")
    .set("X-Tenant-Id", tenant)
    .set("Authorization", auth)
    .set("Idempotency-Key", idemKey)
    .send(body);

  expect(second.status).toBe(200);
  expect(second.body).toEqual(first.body); // ✅ exact payload equality

  // 3️⃣ Verify Redis persistence
  const redisKey = `idem:${tenant}:${idemKey}`;
  const cached = await redis.get(redisKey);
  expect(cached).toBeTruthy();

  const cachedOrder = JSON.parse(cached!);
  expect(cachedOrder.id).toBe(first.body.id);

  // 4️⃣ Verify TTL ~ 86400 seconds
  const ttl = await redis.ttl(redisKey);
  expect(ttl).toBeGreaterThan(86000);

  // 5️⃣ Verify no duplicate orders in memory
  const allOrders = await request(app.server)
    .get("/v1/orders")
    .set("X-Tenant-Id", tenant);
  expect(allOrders.body).toHaveLength(1);
});

test("idempotency key handles concurrent identical POSTs safely", async () => {
  const tenant = "tenant-D";
  const auth = "Bearer RACE_TEST_123";
  const idemKey = "idem-concurrent";
  const body = { item: "Hay Bale", amount: 250 };

  // Fire two concurrent POSTs with same idempotency key
  const [res1, res2] = await Promise.all([
    request(app.server)
      .post("/v1/orders")
      .set("X-Tenant-Id", tenant)
      .set("Authorization", auth)
      .set("Idempotency-Key", idemKey)
      .send(body),
    request(app.server)
      .post("/v1/orders")
      .set("X-Tenant-Id", tenant)
      .set("Authorization", auth)
      .set("Idempotency-Key", idemKey)
      .send(body),
  ]);

  // Both should succeed gracefully
  expect([201, 200]).toContain(res1.status);
  expect([201, 200]).toContain(res2.status);

  // The returned order IDs should be identical
  expect(res1.body.id).toBe(res2.body.id);

  // Redis should contain exactly one record for that key
  const redisKey = `idem:${tenant}:${idemKey}`;
  const cached = await redis.get(redisKey);
  expect(cached).toBeTruthy();
  const cachedOrder = JSON.parse(cached!);
  expect(cachedOrder.id).toBe(res1.body.id);

  // Verify in-memory orders array still has one order
  const allOrders = await request(app.server)
    .get("/v1/orders")
    .set("X-Tenant-Id", tenant);
  expect(allOrders.body).toHaveLength(1);
});
