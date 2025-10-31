import { Order, createOrder } from "../models/index";

const idempotencyMap = new Map<string, Order>();

export function createOrderService(
  tenantId: string,
  idempotencyKey: string,
  data: { item: string; amount: number }
): { order: Order; created: boolean } {
  const key = `${tenantId}:${idempotencyKey}`;
  const existing = idempotencyMap.get(key);
  if (existing) return { order: existing, created: false };

  const order = createOrder(tenantId, data.item, data.amount);
  idempotencyMap.set(key, order);
  return { order, created: true };
}
