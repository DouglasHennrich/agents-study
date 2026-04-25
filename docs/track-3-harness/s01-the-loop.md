# s01. The Loop — `while + stop_reason`

> *"One loop & Bash is all you need"* — o coração do Claude Code é um `while(true)` que chama a API, checa `stop_reason`, executa tools e devolve resultados.

## O que é

Todo agente, no fundo, é este loop:

```
1. envia messages[] + tools[] pro modelo
2. recebe resposta
3. se stop_reason === "tool_use":
     - executa as tools chamadas
     - acrescenta tool_results em messages[]
     - volta pro passo 1
4. caso contrário: yield final, sai
```

Tudo o resto (planning, sub-agents, compaction) é **hook em volta deste loop**.

## Como Claude Code faz

📂 `src/query.ts` — 785 KB. **Sim, num arquivo só.** É o maior do projeto, e justifica: tudo que orbita o loop está lá pra evitar import cycles.

```
query()  ── AsyncGenerator<SDKMessage>
  ├─ assemble system prompt
  ├─ assemble tools[]
  ├─ while (true):
  │     ├─ fetch from API (streaming)
  │     ├─ for await chunk:
  │     │     ├─ yield text deltas → consumer
  │     │     └─ accumulate tool_use blocks
  │     ├─ if (stop_reason !== 'tool_use') break
  │     ├─ StreamingToolExecutor.run(toolUses) → tool_results
  │     └─ messages.push(assistant, tool_results)
  └─ yield final
```

Pontos-chave:

- **AsyncGenerator end-to-end** — text streaming chega ao usuário sem buffer intermediário.
- **`StreamingToolExecutor`** roda tools `concurrencySafe` em paralelo, serializa o resto.
- **`stop_reason === 'tool_use'`** é a única condição de continuação.
- Persiste cada turno via `recordTranscript()` (fire-and-forget, ordem garantida).

## Versão didática (claude-mini)

📄 `src/query.ts`

```ts
import type { LlmProvider, Message, ContentBlock } from './provider/types.js';
import { ToolRegistry } from './tools/registry.js';

export interface QueryInput {
  provider: LlmProvider;
  prompt: string;
  model?: string;
  systemPrompt?: string;
  tools?: ToolRegistry;
  maxTurns?: number;
}

export interface QueryEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'final';
  text?: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  is_error?: boolean;
  cost?: number;
  usage?: { input_tokens: number; output_tokens: number };
}

export async function* runQuery(input: QueryInput): AsyncGenerator<QueryEvent> {
  const tools = input.tools ?? new ToolRegistry();
  const maxTurns = input.maxTurns ?? 10;
  const messages: Message[] = [
    { role: 'user', content: input.prompt },
  ];

  let totalUsage = { input_tokens: 0, output_tokens: 0 };

  for (let turn = 0; turn < maxTurns; turn++) {
    const assistantBlocks: ContentBlock[] = [];
    let stopReason: string | undefined;
    let pendingToolUse: ContentBlock | null = null;
    let pendingJson = '';

    // 1. stream da API
    for await (const evt of input.provider.stream({
      system: input.systemPrompt ?? 'Você é um assistente útil.',
      messages,
      tools: tools.toApiSpec(),
      model: input.model,
    })) {
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
        yield { type: 'text', text: evt.delta.text };
        const last = assistantBlocks.at(-1);
        if (last?.type === 'text') last.text = (last.text ?? '') + evt.delta.text;
        else assistantBlocks.push({ type: 'text', text: evt.delta.text });
      }

      if (evt.type === 'content_block_delta' && evt.delta?.type === 'input_json_delta') {
        pendingJson += evt.delta.partial_json ?? '';
      }

      if (evt.type === 'content_block_stop' && pendingToolUse) {
        try { pendingToolUse.input = JSON.parse(pendingJson || '{}'); }
        catch { pendingToolUse.input = {}; }
        assistantBlocks.push(pendingToolUse);
        pendingToolUse = null;
        pendingJson = '';
      }

      if (evt.type === 'tool_use_complete' && evt.block) {
        // alguns providers já entregam o tool_use montado
        assistantBlocks.push(evt.block);
      }

      if (evt.type === 'message_delta' && evt.stop_reason) stopReason = evt.stop_reason;

      if (evt.type === 'message_stop' && evt.usage) {
        totalUsage.input_tokens += evt.usage.input_tokens;
        totalUsage.output_tokens += evt.usage.output_tokens;
      }
    }

    // 2. acrescenta resposta do assistant
    messages.push({ role: 'assistant', content: assistantBlocks });

    // 3. fim?
    if (stopReason !== 'tool_use') {
      yield { type: 'final', usage: totalUsage, cost: estimateCost(totalUsage) };
      return;
    }

    // 4. executa tools
    const toolUses = assistantBlocks.filter(b => b.type === 'tool_use');
    const toolResults: ContentBlock[] = [];

    for (const tu of toolUses) {
      yield { type: 'tool_use', name: tu.name, input: tu.input };
      const result = await tools.execute(tu.name!, tu.input);
      yield {
        type: 'tool_result',
        name: tu.name,
        output: result.output,
        is_error: result.is_error,
      };
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: typeof result.output === 'string'
          ? result.output
          : JSON.stringify(result.output),
        is_error: result.is_error,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  yield { type: 'final', usage: totalUsage, cost: estimateCost(totalUsage) };
}

function estimateCost(usage: { input_tokens: number; output_tokens: number }) {
  // sonnet preço aprox.: $3/M in, $15/M out
  return (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
}
```

## Por que esse padrão?

| Decisão | Razão |
|---|---|
| `AsyncGenerator` em vez de Promise | streaming chega ao usuário tão rápido quanto a API entrega |
| `for-await` sobre stream do SDK | preserva ordem dos blocks |
| `messages.push(assistant)` antes do tool exec | tool_results precisam referenciar `tool_use_id` do mesmo turno |
| `maxTurns` | proteção contra loop infinito de tool_call |
| `tool_result` em role `user` | é como a API Anthropic espera |
| `is_error: true` em vez de exception | o **modelo** decide se retenta ou desiste |

## Anti-padrões

- ❌ Buffer toda a resposta antes de mostrar pro usuário (TTFB ruim).
- ❌ Executar tools concorrentemente sem checar `concurrencySafe` (race em FS).
- ❌ Esquecer `tool_use_id` (modelo não consegue casar request com resposta).
- ❌ Loop sem `maxTurns` (custo explode em bug de modelo).

## ✓ Validar

📄 `tests/query.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/query.js';

class StubProvider {
  async *stream() {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'oi!' } };
    yield { type: 'message_delta', stop_reason: 'end_turn' };
    yield { type: 'message_stop', usage: { input_tokens: 5, output_tokens: 1 } };
  }
}

describe('runQuery', () => {
  it('yield text e final em conversa simples', async () => {
    const events: any[] = [];
    for await (const e of runQuery({ provider: new StubProvider() as any, prompt: 'oi' })) {
      events.push(e);
    }
    expect(events.find(e => e.type === 'text')?.text).toBe('oi!');
    expect(events.find(e => e.type === 'final')).toBeTruthy();
  });
});
```

```bash
npm test -- query
```

## Próximo

→ [s02. Tool Dispatch — `buildTool` factory](s02-tool-dispatch.md)
