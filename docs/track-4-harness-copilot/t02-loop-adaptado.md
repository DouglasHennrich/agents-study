# t02. Loop adaptado — `tool_calls` vs `tool_use`

## A diferença fundamental

| Anthropic (T3) | OpenAI/Copilot (T4) |
|---|---|
| Modelo retorna `content[]` com blocks misturados | Modelo retorna `content` (texto) **+** `tool_calls[]` separado |
| Tool result vai num bloco `tool_result` dentro de uma msg `user` | Tool result vai numa msg **`role:"tool"`** com `tool_call_id` |
| `system` é parâmetro à parte | `system` é `messages[0]` |

## Loop reescrito

📄 `src/query.ts`

```ts
import type { LlmProvider, Message } from './provider/types.js';
import { ToolRegistry, type ToolContext } from './tools/registry.js';

export interface RunQueryInput {
  provider: LlmProvider;
  systemPrompt?: string;
  prompt?: string;
  messages?: Message[];
  tools?: ToolRegistry;
  model?: string;
  maxTurns?: number;
  cwd?: string;
  signal?: AbortSignal;          // cancelamento cooperativo (passado às tools)
}

export type QueryEvent =
  | { type: 'turn_start'; turn: number }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; output: string; is_error: boolean }
  | { type: 'final'; messages: Message[]; cost?: number; turns: number };

export async function* runQuery(input: RunQueryInput): AsyncGenerator<QueryEvent> {
  const tools = input.tools ?? new ToolRegistry();
  const ctx: ToolContext = { cwd: input.cwd ?? process.cwd() };
  const maxTurns = input.maxTurns ?? 25;

  const messages: Message[] = [];
  if (input.systemPrompt) messages.push({ role: 'system', content: input.systemPrompt });
  if (input.messages) messages.push(...input.messages);
  if (input.prompt) messages.push({ role: 'user', content: input.prompt });

  let turn = 0;
  let totalIn = 0, totalOut = 0;

  while (turn < maxTurns) {
    turn++;
    yield { type: 'turn_start', turn };

    let finishReason: 'stop' | 'tool_calls' | 'length' | 'error' = 'stop';
    let assistantMsg: Message = { role: 'assistant', content: null };

    for await (const evt of input.provider.stream({
      messages,
      tools: tools.toSpecs(),
      model: input.model,
    })) {
      if (evt.type === 'text_delta') yield { type: 'text', text: evt.text };
      if (evt.type === 'message_stop') {
        finishReason = evt.finish_reason;
        assistantMsg = evt.message;
        if (evt.usage) {
          totalIn += evt.usage.prompt_tokens;
          totalOut += evt.usage.completion_tokens;
        }
      }
    }

    messages.push(assistantMsg);

    if (finishReason !== 'tool_calls' || !assistantMsg.tool_calls?.length) break;

    // Para cada tool_call, executar e adicionar 1 mensagem role:"tool"
    for (const call of assistantMsg.tool_calls) {
      yield { type: 'tool_use', id: call.id, name: call.name, input: call.arguments };
      const res = await tools.execute(call.name, call.arguments, ctx);
      yield { type: 'tool_result', id: call.id, output: res.output, is_error: res.is_error };
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: res.is_error ? `[error] ${res.output}` : res.output,
      });
    }
  }

  // GPT-4o-mini ~ $0.15/M input, $0.60/M output
  const cost = (totalIn * 0.15 + totalOut * 0.6) / 1_000_000;
  yield { type: 'final', messages, cost, turns: turn };
}
```

## Diferenças concretas vs T3

| Coisa | T3 | T4 |
|---|---|---|
| System prompt | `provider.stream({ system: '...' })` | `messages[0] = { role:'system' }` |
| Detectar tool calls | `block.type === 'tool_use'` | `assistantMsg.tool_calls?.length > 0` |
| Resposta da tool | 1 msg `user` com array de blocks `tool_result` | **N** msgs `tool` (uma por call) |
| Stop condition | `stop_reason === 'end_turn'` | `finish_reason === 'stop'` (ou sem tool_calls) |
| Estimativa de custo | $3/$15 por M (Sonnet 4.5) | $0.15/$0.60 por M (gpt-4o-mini) |

## Por que **N** mensagens role:"tool" e não 1?

O protocolo OpenAI **exige** uma msg por `tool_call_id`. Diferente da Anthropic, onde múltiplos `tool_result` podem ser empilhados num único turno `user`.

Se você esquecer e enviar uma única mensagem combinando vários, a próxima chamada falha:

```
400 error: 'tool' messages must respond to a previous tool_call by id
```

## Estado intermediário (debug)

Após um turno com 2 tool_calls, `messages` fica assim:

```jsonc
[
  { "role": "system",    "content": "Você é o claude-mini-copilot." },
  { "role": "user",      "content": "liste arquivos e leia README.md" },
  { "role": "assistant", "content": null,
    "tool_calls": [
      { "id": "call_1", "name": "glob", "arguments": {"pattern": "**/*.md"} },
      { "id": "call_2", "name": "file_read", "arguments": {"path": "README.md"} }
    ]
  },
  { "role": "tool", "tool_call_id": "call_1", "content": "[\"README.md\",\"docs/foo.md\"]" },
  { "role": "tool", "tool_call_id": "call_2", "content": "# Projeto\n..." }
]
```

## Próximo

→ [t03. Tools no formato OpenAI function-calling](t03-tools-openai-format.md)
