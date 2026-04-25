// Tool registry + buildTool factory (s02) — adapter OpenAI format.
//
// Diferença vs claude-mini: toSpecs() retorna {name, description, parameters}
// (sem o wrapping {type:'function', function:{...}} — isso fica no CopilotProvider).

import { z, ZodTypeAny } from 'zod';

export interface BuildToolInput<S extends ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  isReadOnly?: boolean;
  isDestructive?: boolean;
  isConcurrencySafe?: boolean;
  call: (input: z.infer<S>, ctx: ToolContext) => Promise<unknown> | unknown;
}

export interface Tool {
  name: string;
  description: string;
  schema: ZodTypeAny;
  isReadOnly: boolean;
  isDestructive: boolean;
  isConcurrencySafe: boolean;
  call: (input: unknown, ctx: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  cwd: string;
  signal?: AbortSignal;
}

export function buildTool<S extends ZodTypeAny>(input: BuildToolInput<S>): Tool {
  return {
    name: input.name,
    description: input.description,
    schema: input.schema,
    isReadOnly: input.isReadOnly ?? false,
    isDestructive: input.isDestructive ?? false,
    isConcurrencySafe: input.isConcurrencySafe ?? false,
    async call(raw: unknown, ctx: ToolContext) {
      const parsed = input.schema.parse(raw);
      return await input.call(parsed, ctx);
    },
  };
}

export interface ToolExecResult {
  output: string;
  is_error: boolean;
}

import { isPlanMode } from './plan-mode.js';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(t: Tool): this {
    this.tools.set(t.name, t);
    return this;
  }

  has(name: string): boolean { return this.tools.has(name); }
  get(name: string): Tool | undefined { return this.tools.get(name); }
  list(): Tool[] { return [...this.tools.values()]; }

  /** Formato OpenAI: {name, description, parameters}. O wrapping
   * {type:'function', function:{...}} é responsabilidade do provider. */
  toSpecs() {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.schema),
    }));
  }

  async execute(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolExecResult> {
    const tool = this.tools.get(name);
    if (!tool) return { output: `unknown tool: ${name}`, is_error: true };

    if (isPlanMode() && tool.isDestructive) {
      return {
        output: `tool ${name} bloqueada em plan mode. Saia com exit_plan_mode antes.`,
        is_error: true,
      };
    }

    try {
      const out = await tool.call(rawInput, ctx);
      return { output: typeof out === 'string' ? out : JSON.stringify(out), is_error: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { output: `error: ${msg}`, is_error: true };
    }
  }
}

// Zod → JSON Schema mínimo (apenas o necessário para tools simples).
function zodToJsonSchema(schema: ZodTypeAny): object {
  if (schema instanceof z.ZodObject) {
    const shape = (schema as any).shape;
    const properties: Record<string, object> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      const v = value as ZodTypeAny;
      properties[key] = zodToJsonSchema(v);
      if (!v.isOptional()) required.push(key);
    }
    return { type: 'object', properties, required };
  }
  if (schema instanceof z.ZodString) return { type: 'string' };
  if (schema instanceof z.ZodNumber) return { type: 'number' };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodArray) return { type: 'array', items: zodToJsonSchema((schema as any)._def.type) };
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: (schema as any)._def.values };
  if (schema instanceof z.ZodOptional) return zodToJsonSchema((schema as any)._def.innerType);
  if (schema instanceof z.ZodDefault) return zodToJsonSchema((schema as any)._def.innerType);
  if (schema instanceof z.ZodRecord) return { type: 'object' };
  return { type: 'string' };
}
