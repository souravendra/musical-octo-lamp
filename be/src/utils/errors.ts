import { FastifyReply } from "fastify";

export function sendProblem(
  reply: FastifyReply,
  status: number,
  code: string,
  detail: string,
  errors?: Array<{ name: string; reason: string }>
) {
  return reply
    .code(status)
    .type("application/problem+json")
    .send({
      type: `https://example.com/problems/${code}`,
      title: detail,
      status,
      detail,
      instance: reply.request.url,
      ...(errors ? { errors } : {}),
    });
}
