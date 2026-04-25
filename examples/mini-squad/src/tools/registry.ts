import { z } from 'zod';
import type { ToolSchema } from '../client/types.js';
import type { Tool, ToolContext, ToolResult } from './types.js';

/**
 * Converte um ZodType em JSON Schema básico (suficiente para o protocolo
 * de tools do Copilot/OpenAI). Cobre objects/strings/numbers/booleans/arrays.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodString) return { type: 'string' };
  if (schema instanceof z.ZodNumber) return { type: 'number' };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodArray) {
    return { type: 'array', items: zodToJsonSchema(schema.element) };
  }
  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: schema.options };
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap());
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      properties[k] = zodToJsonSchema(v);
      if (!(v instanceof z.ZodOptional)) required.push(k);
    }
    return { type: 'object', properties, required };
  }
  return {}; // fallback genérico
}

/**
 * Registry centralizado de tools. Inspirado em
 * `packages/squad-sdk/src/tools/` do Squad.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register<I, O>(tool: Tool<I, O>): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool já registrada: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  /** Schemas em formato OpenAI/Copilot, prontos para enviar ao LLM. */
  schemas(): ToolSchema[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.input),
    }));
  }

  async run(
    name: string,
    rawInput: unknown,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `Tool desconhecida: ${name}` };

    const parsed = tool.input.safeParse(rawInput);
    if (!parsed.success) {
      return { ok: false, error: `Args inválidos: ${parsed.error.message}` };
    }

    try {
      const value = await tool.run(parsed.data, ctx);
      return { ok: true, value };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
