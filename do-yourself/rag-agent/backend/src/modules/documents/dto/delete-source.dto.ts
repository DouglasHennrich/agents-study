import { z } from "zod";

export const deleteSourceDtoParamSchema = z.object({
  source: z.string().min(1),
});

export type TDeleteSourceDtoParamSchema = z.infer<
  typeof deleteSourceDtoParamSchema
>;
