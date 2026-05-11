import { z } from "zod";

export const envSchema = z.object({
  INFRA_PORT: z.coerce.number().default(3000),
  INFRA_ENVIRONMENT: z.enum(["development", "production"]),
  DATABASE_HOST: z.string().default("localhost"),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_USER: z.string(),
  DATABASE_PASSWORD: z.string(),
  DATABASE_NAME: z.string(),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),
  OLLAMA_LLM_MODEL: z.string().default("llama3"),
  UTILITIES_PAGINATION_LIMIT: z.coerce.number().default(100),
  RAG_CHUNK_SIZE: z.coerce.number().default(500),
  RAG_CHUNK_OVERLAP: z.coerce.number().default(50),
  RAG_TOP_K: z.coerce.number().default(5),
  RAG_SIMILARITY_THRESHOLD: z.coerce.number().default(0.6),
});

export type TEnvironment = z.infer<typeof envSchema>;
