import { z } from "zod";

export const listSourcesDtoQuerySchema = z.object({});

export type TListSourcesDtoQuerySchema = z.infer<
  typeof listSourcesDtoQuerySchema
>;
