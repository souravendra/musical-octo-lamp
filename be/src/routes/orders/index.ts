import { FastifyInstance } from "fastify";
import { sendProblem } from "../../utils/errors";
import {
  createOrderController,
  getOrderController,
  listOrdersController,
} from "../../orders/controllers/index";

export default async function orderRoutes(app: FastifyInstance) {
  // Tenant + Auth middleware
  app.addHook("onRequest", (req, reply, done) => {
    const tenant = req.headers["x-tenant-id"];
    const auth = req.headers["authorization"];

    if (!tenant)
      return sendProblem(
        reply,
        400,
        "missing-tenant",
        "X-Tenant-Id header required."
      );
    if (!auth?.startsWith("Bearer "))
      return sendProblem(
        reply,
        401,
        "unauthorized",
        "Missing or invalid Authorization header."
      );
    if (
      process.env.NODE_ENV !== "test" &&
      auth.split(" ")[1] !== process.env.API_KEY
    )
      return sendProblem(reply, 403, "forbidden", "Invalid API key.");
    done();
  });

  app.post("/v1/orders", createOrderController);
  app.get("/v1/orders/:id", getOrderController);
  app.get("/v1/orders", listOrdersController);
}
