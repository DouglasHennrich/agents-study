import type { z } from 'zod';
import type { ToolSchema } from '../client/types.js';

/**
 * Definição de uma Tool: nome, schema Zod (vira JSON Schema) e implementação.
 */
export interface Tool<I = any, O = any> {
  name: string;
  description: string;
  input: z.ZodType<I>;
  run(input: I, ctx: ToolContext): Promise<O>;
}

export interface ToolContext {
  sessionId: string;
  agentName: string;
  signal?: AbortSignal;
}

/**
 * Resultado da execução de uma tool.
 */
export type ToolResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };
