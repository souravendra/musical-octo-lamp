import { findOrderById, listOrders } from "../models/index";

export function getOrderService(tenantId: string, id: string) {
  return findOrderById(tenantId, id);
}

export function listOrdersService(
  tenantId: string,
  limit: number,
  cursor?: string
) {
  return listOrders(tenantId, limit, cursor);
}
