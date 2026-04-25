# t01. CopilotProvider — Chat Completions adapter

## Tipos OpenAI-style

📄 `src/provider/types.ts`

```ts
export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface Message {
  role: Role;
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;       // para mensagens role:"tool"
  name?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: object;          // JSON Schema
}

export interface StreamRequest {
  messages: Message[];          // system entra como messages[0]
  tools: ToolSpec[];
  model?: string;
  max_tokens?: number;
}

export type StreamEvent =
  | { type: 'message_start' }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_delta'; id: string; name?: string; argumentsPartial?: string }
  | {
      type: 'message_stop';
      finish_reason: 'stop' | 'tool_calls' | 'length' | 'error';
      message: Message;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

export interface LlmProvider {
  name: string;
  stream(req: StreamRequest): AsyncIterable<StreamEvent>;
}
```

## Adapter sobre `@github/copilot-sdk`

📄 `src/provider/copilot.ts`

```ts
import type { LlmProvider, StreamRequest, StreamEvent, Message, ToolCall } from './types.js';

export class CopilotProvider implements LlmProvider {
  name = 'copilot';
  private clientPromise?: Promise<any>;

  constructor(private opts: { token?: string; model?: string } = {}) {}

  private async getClient(): Promise<any> {
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      const mod: any = await import('@github/copilot-sdk').catch(() => null);
      if (!mod) throw new Error('`@github/copilot-sdk` não instalado.');
      const Client = mod.CopilotClient ?? mod.default;
      return new Client({
        token: this.opts.token ?? process.env.COPILOT_TOKEN,
      });
    })();
    return this.clientPromise;
  }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    const client = await this.getClient();
    const res = await client.chat.completions.create({
      model: req.model ?? this.opts.model ?? process.env.COPILOT_MODEL ?? 'gpt-4o-mini',
      messages: req.messages.map(toOpenAi),
      tools: req.tools.length > 0
        ? req.tools.map((t) => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.parameters },
          }))
        : undefined,
      stream: false,
    });
    const choice = res.choices[0];
    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParse(tc.function.arguments),
    }));

    yield { type: 'message_start' };
    if (choice.message.content) {
      yield { type: 'text_delta', text: choice.message.content };
    }
    if (toolCalls) {
      for (const tc of toolCalls) {
        yield { type: 'tool_call_delta', id: tc.id, name: tc.name,
                argumentsPartial: JSON.stringify(tc.arguments) };
      }
    }
    yield {
      type: 'message_stop',
      finish_reason: choice.finish_reason,
      message: {
        role: 'assistant',
        content: choice.message.content ?? null,
        tool_calls: toolCalls,
      },
      usage: res.usage,
    };
  }
}

function toOpenAi(m: Message): any {
  const out: any = { role: m.role };
  if (m.content !== undefined) out.content = m.content;
  if (m.tool_calls) {
    out.tool_calls = m.tool_calls.map((tc) => ({
      id: tc.id, type: 'function',
      function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
    }));
  }
  if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
  if (m.name) out.name = m.name;
  return out;
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
```

## MockProvider equivalente

Versão de teste sem rede — espelha o que fizemos no `claude-mini`:

```ts
export interface MockTurn {
  text?: string;
  tool_calls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  finish_reason?: 'stop' | 'tool_calls' | 'length';
}

export class MockProvider implements LlmProvider {
  name = 'mock';
  public calls: StreamRequest[] = [];
  private idx = 0;
  constructor(private script: MockTurn[] = []) {}

  reset(s?: MockTurn[]) { if (s) this.script = s; this.idx = 0; this.calls = []; }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    this.calls.push(req);
    const turn = this.script[this.idx++] ?? { text: '' };
    yield { type: 'message_start' };

    const toolCalls = turn.tool_calls?.map((tc, i) => ({
      id: `call_${this.idx}_${i}`, name: tc.name, arguments: tc.arguments,
    }));

    if (turn.text) yield { type: 'text_delta', text: turn.text };
    if (toolCalls) {
      for (const tc of toolCalls) {
        yield { type: 'tool_call_delta', id: tc.id, name: tc.name,
                argumentsPartial: JSON.stringify(tc.arguments) };
      }
    }
    const finish = turn.finish_reason ?? (toolCalls ? 'tool_calls' : 'stop');
    yield {
      type: 'message_stop',
      finish_reason: finish,
      message: {
        role: 'assistant',
        content: turn.text ?? null,
        tool_calls: toolCalls,
      },
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };
  }
}
```

## Por que não streaming verdadeiro?

A versão acima pede `stream: false` ao SDK, depois "fakeia" os deltas. Razão:

- O `@github/copilot-sdk` retorna chunks com `delta.tool_calls[i].function.arguments` em pedacinhos JSON parciais.
- Concatenar arguments parciais com índices é **complexo**, e o ganho didático é zero.
- Para um tutorial, pegar a resposta inteira e emitir 1 delta funciona perfeitamente.

Se quiser streaming real, troque o `await client.chat.completions.create({stream:false})` por `for await (const chunk of res)` e acumule `delta.tool_calls`.

## Próximo

→ [t02. Loop adaptado — `tool_calls` vs `tool_use`](t02-loop-adaptado.md)
