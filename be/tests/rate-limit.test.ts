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

test("tenant-level rate limit applies correctly and resets", async () => {
  const tenantA = "tenant-A";
  const tenantB = "tenant-B";
  const auth = "Bearer XYZ123";

  // First 5 requests should pass for tenantA
  for (let i = 0; i < 5; i++) {
    const res = await request(app.server)
      .get("/v1/orders")
      .set("X-Tenant-Id", tenantA)
      .set("Authorization", auth);

    expect(res.status, `Request ${i + 1} should be allowed`).toBe(200);
    //expect(res.headers).toHaveProperty("x-ratelimit-remaining");
  }

  // 6th request should be blocked
  const blocked = await request(app.server)
    .get("/v1/orders")
    .set("X-Tenant-Id", tenantA)
    .set("Authorization", auth);

  expect(blocked.status).toBe(429);
  expect(blocked.body).toHaveProperty("error");
  expect(blocked.headers).toHaveProperty("retry-after");

  // TenantB should still pass (separate bucket)
  const otherTenant = await request(app.server)
    .get("/v1/orders")
    .set("X-Tenant-Id", tenantB)
    .set("Authorization", auth);

  expect(otherTenant.status).toBe(200);

  // After 10s, rate limit should reset
  await new Promise((r) => setTimeout(r, 10500));
  const reset = await request(app.server)
    .get("/v1/orders")
    .set("X-Tenant-Id", tenantA)
    .set("Authorization", auth);

  expect(reset.status).toBe(200);
});
