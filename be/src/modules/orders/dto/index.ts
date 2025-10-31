import { z } from "zod";

export const createOrderSchema = z.object({
  item: z.string().min(1),
  amount: z.number().positive(),
});

export const querySchema = z.object({
  limit: z.coerce.number().positive().max(100).default(10),
  cursor: z.string().uuid().optional(),
});
