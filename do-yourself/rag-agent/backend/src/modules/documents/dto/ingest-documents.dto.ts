import { z } from "zod";

export const ingestDocumentsDtoServiceSchema = z.object({
  fileName: z.string(),
  mimeType: z.literal("application/pdf"),
});

export type TIngestDocumentsDtoServiceSchema = z.infer<
  typeof ingestDocumentsDtoServiceSchema
>;
