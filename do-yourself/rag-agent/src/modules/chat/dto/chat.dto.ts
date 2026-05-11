import { z } from "zod";

export const chatDtoBodySchema = z.object({
  question: z.string().min(1).max(2000),
  source: z.string().optional(),
  topK: z.coerce.number().min(1).max(20).optional(),
});

export type TChatDtoBodySchema = z.infer<typeof chatDtoBodySchema>;
