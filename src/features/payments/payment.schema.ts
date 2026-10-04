import { z } from "zod";

export const createOrderSchema = z.object({
  proposalToken: z.string().min(1),
});

export const captureOrderSchema = z.object({
  orderId: z.string().min(1),
  proposalToken: z.string().min(1),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CaptureOrderInput = z.infer<typeof captureOrderSchema>;
