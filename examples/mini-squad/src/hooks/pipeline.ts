import type { Message, ToolCall } from '../client/types.js';
import type { ToolContext } from '../tools/types.js';

/**
 * Eventos pelos quais a HookPipeline pode interceptar.
 *
 *  - before_tool : antes da execução da tool. Pode bloquear ou rewrite args.
 *  - after_tool  : após a execução. Pode mascarar o output (ex.: PII).
 *  - before_llm  : antes de cada chamada ao LLM. Pode injetar/limpar mensagens.
 *
 * Inspirado em `packages/squad-sdk/src/hooks/`.
 */
export type HookKind = 'before_tool' | 'after_tool' | 'before_llm';

export interface BeforeToolPayload {
  kind: 'before_tool';
  call: ToolCall;
  ctx: ToolContext;
}

export interface AfterToolPayload {
  kind: 'after_tool';
  call: ToolCall;
  ctx: ToolContext;
  output: unknown;
}

export interface BeforeLlmPayload {
  kind: 'before_llm';
  messages: Message[];
  ctx: ToolContext;
}

export type HookPayload =
  | BeforeToolPayload
  | AfterToolPayload
  | BeforeLlmPayload;

export type HookDecision =
  | { type: 'allow' }
  | { type: 'rewrite'; payload: HookPayload }
  | { type: 'deny'; reason: string };

export interface Hook {
  kind: HookKind;
  name: string;
  run(payload: HookPayload): Promise<HookDecision> | HookDecision;
}

export class HookPipeline {
  private hooks: Hook[] = [];

  register(hook: Hook): this {
    this.hooks.push(hook);
    return this;
  }

  async dispatch(payload: HookPayload): Promise<HookDecision> {
    let current = payload;
    for (const h of this.hooks) {
      if (h.kind !== payload.kind) continue;
      const d = await h.run(current);
      if (d.type === 'deny') return d;
      if (d.type === 'rewrite') current = d.payload;
    }
    return current === payload
      ? { type: 'allow' }
      : { type: 'rewrite', payload: current };
  }
}
