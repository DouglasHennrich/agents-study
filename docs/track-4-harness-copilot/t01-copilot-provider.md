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

## Adapter sobre `@github/copilot-sdk` v0.3+

📄 `src/provider/copilot.ts`

> **SDK v0.3+ — arquitetura baseada em sessões JSON-RPC**
>
> Versões antigas do SDK expunham `client.chat.completions.create()` (formato OpenAI). O SDK v0.3+ usa sessões persistentes via JSON-RPC: você cria uma sessão com `createSession()`, envia mensagens com `session.send()` / `session.sendAndWait()`, e recebe eventos (`assistant.message_delta`, `session.idle`, etc.).
>
> **Tool calls**: com o SDK v0.3+, as tools são registradas com handlers no `createSession()`. O SDK executa o loop ReAct internamente — o `message_stop` retornará sempre `finish_reason: 'stop'` com o texto final (após o SDK ter resolvido eventuais tool calls).

```ts
import { CopilotClient, approveAll } from '@github/copilot-sdk';
import type { LlmProvider, StreamRequest, StreamEvent, Message } from './types.js';

export class CopilotProvider implements LlmProvider {
  name = 'copilot';
  private client: CopilotClient;

  constructor(private opts: { token?: string; model?: string } = {}) {
    this.client = new CopilotClient({
      gitHubToken: this.opts.token ?? process.env.COPILOT_TOKEN,
    });
  }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    const systemContent = req.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .filter(Boolean)
      .join('\n');

    const nonSystemMessages = req.messages.filter(m => m.role !== 'system');

    const session = await this.client.createSession({
      model: req.model ?? this.opts.model ?? process.env.COPILOT_MODEL ?? 'gpt-4o-mini',
      streaming: true,
      onPermissionRequest: approveAll,
      ...(systemContent ? {
        systemMessage: { mode: 'replace' as const, content: systemContent },
      } : {}),
    });

    try {
      // Replay turns anteriores para manter contexto multi-turn
      for (const msg of nonSystemMessages.slice(0, -1)) {
        if (msg.role === 'user') {
          await session.sendAndWait({ prompt: msg.content ?? '' });
        }
      }

      const lastMsg = nonSystemMessages.at(-1);

      // Bridge callbacks → AsyncIterable (resolvers-first: garante await por chunk)
      type Item = StreamEvent | 'done';
      const pending: Item[] = [];
      let waiting: ((item: Item) => void) | null = null;

      const push = (item: Item) => {
        if (waiting) { waiting(item); waiting = null; }
        else { pending.push(item); }
      };
      const pull = (): Promise<Item> => {
        if (pending.length > 0) return Promise.resolve(pending.shift()!);
        return new Promise<Item>(resolve => { waiting = resolve; });
      };

      let fullContent = '';

      const unsubDelta = session.on('assistant.message_delta', (event) => {
        const text = (event.data as any).deltaContent ?? '';
        fullContent += text;
        push({ type: 'text_delta', text });
      });

      const unsubIdle = session.on('session.idle', () => {
        unsubDelta(); unsubIdle();
        push('done');
      });

      yield { type: 'message_start' };
      await session.send({ prompt: lastMsg?.content ?? '' });

      while (true) {
        const item = await pull();
        if (item === 'done') break;
        yield item as StreamEvent;
      }

      yield {
        type: 'message_stop',
        finish_reason: 'stop',
        message: { role: 'assistant', content: fullContent || null } as Message,
        usage: undefined,
      };
    } finally {
      await session.disconnect();
    }
  }
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

## Streaming real com SDK v0.3+

O SDK v0.3+ emite eventos `assistant.message_delta` com `deltaContent` à medida que o modelo gera tokens. A implementação acima usa o padrão **resolvers-first**: o consumer sempre faz `await pull()` antes de cada `yield`, garantindo que chunks sejam entregues incrementalmente.

Ao contrário da API OpenAI-compatible anterior (que usava `chat.completions.create({stream:true})`), não há `delta.tool_calls` para acumular — o loop ReAct é interno ao SDK.

## Próximo

→ [t02. Loop adaptado — `tool_calls` vs `tool_use`](t02-loop-adaptado.md)

