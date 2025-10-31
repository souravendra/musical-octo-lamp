import { FastifyRequest, FastifyReply } from "fastify";
import { sendProblem } from "../../../utils/errors";
import { createOrderSchema, querySchema } from "../dto/index";
import { createOrderService } from "../services/create";
import { getOrderService, listOrdersService } from "../services/get";

export async function createOrderController(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = req.headers["x-tenant-id"] as string;
  const key = req.headers["idempotency-key"] as string;
  if (!key)
    return sendProblem(
      reply,
      400,
      "missing-idempotency-key",
      "Idempotency-Key header required."
    );

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(
      reply,
      422,
      "validation-error",
      "Invalid request body.",
      parsed.error.errors.map((e) => ({
        name: e.path.join("."),
        reason: e.message,
      }))
    );
  }

  const { order, created } = createOrderService(tenantId, key, parsed.data);
  reply.code(created ? 201 : 200).send(order);
}

// GET /v1/orders/:id
export async function getOrderController(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = req.headers["x-tenant-id"] as string;
  const { id } = req.params as { id: string };
  const order = getOrderService(tenantId, id);
  if (!order) return sendProblem(reply, 404, "not-found", "Order not found.");
  reply.send(order);
}

// GET /v1/orders
export async function listOrdersController(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = req.headers["x-tenant-id"] as string;
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success)
    return sendProblem(
      reply,
      400,
      "invalid-query",
      "Invalid query parameters."
    );

  const { limit, cursor } = parsed.data;
  const data = listOrdersService(tenantId, limit, cursor);
  reply.send(data);
}
