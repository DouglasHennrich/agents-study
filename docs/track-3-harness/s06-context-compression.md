# s06. Context Compression — 3 estratégias

> *"Contexto enche; abra espaço."* Claude Code roda 3 estratégias complementares.

## Como Claude Code faz

📂 `src/services/compact/`

| Estratégia | O que faz | Quando dispara |
|---|---|---|
| **autoCompact** | resume mensagens antigas via chamada LLM separada | tokens > threshold (ex.: 70% do max) |
| **snipCompact** | remove "zombies" — tool_results sem tool_use, msgs vazias | bandeira `HISTORY_SNIP` ativa |
| **contextCollapse** | reestrutura blocos para forma mais compacta (multi-text → single) | bandeira `CONTEXT_COLLAPSE` |

Tudo orbita um **`compact_boundary`** — marker no histórico que separa "já comprimido" de "fresco".

```
[summary of older]
[compact_boundary]
[recent messages — full fidelity]
```

## Versão didática

📄 `src/compact/types.ts`

```ts
import type { Message } from '../provider/types.js';

export interface CompactStrategy {
  shouldRun(messages: Message[], approxTokens: number): boolean;
  apply(messages: Message[]): Promise<Message[]>;
}
```

📄 `src/compact/auto.ts`

```ts
import type { CompactStrategy } from './types.js';
import type { Message, LlmProvider } from '../provider/types.js';

export class AutoCompactStrategy implements CompactStrategy {
  constructor(private provider: LlmProvider, private thresholdTokens = 100_000) {}

  shouldRun(_msgs: Message[], approxTokens: number): boolean {
    return approxTokens > this.thresholdTokens;
  }

  async apply(messages: Message[]): Promise<Message[]> {
    if (messages.length < 6) return messages;
    const cutoff = Math.floor(messages.length / 2);
    const old = messages.slice(0, cutoff);
    const recent = messages.slice(cutoff);

    let summary = '';
    for await (const evt of this.provider.stream({
      system: 'Resuma a conversa abaixo em até 500 palavras, preservando decisões e fatos importantes.',
      messages: [{ role: 'user', content: JSON.stringify(old).slice(0, 50_000) }],
      tools: [],
      max_tokens: 1000,
    })) {
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        summary += evt.delta.text ?? '';
      }
    }

    return [
      { role: 'user', content: `[compact summary]\n${summary}\n[/compact summary]` },
      { role: 'assistant', content: 'Entendido, continuemos.' },
      ...recent,
    ];
  }
}
```

📄 `src/compact/snip.ts`

```ts
import type { CompactStrategy } from './types.js';
import type { Message, ContentBlock } from '../provider/types.js';

export class SnipCompactStrategy implements CompactStrategy {
  shouldRun(messages: Message[]): boolean { return messages.length > 20; }

  async apply(messages: Message[]): Promise<Message[]> {
    return messages.filter(m => {
      // remove msgs vazias
      if (typeof m.content === 'string' && !m.content.trim()) return false;
      if (Array.isArray(m.content) && m.content.length === 0) return false;
      // remove tool_results órfãos
      if (Array.isArray(m.content)) {
        const hasOrphan = m.content.some((b: ContentBlock) =>
          b.type === 'tool_result' && !b.tool_use_id
        );
        if (hasOrphan) return false;
      }
      return true;
    });
  }
}
```

📄 `src/compact/collapse.ts`

```ts
import type { CompactStrategy } from './types.js';
import type { Message, ContentBlock } from '../provider/types.js';

export class CollapseStrategy implements CompactStrategy {
  shouldRun(messages: Message[]): boolean {
    return messages.some(m => Array.isArray(m.content) && m.content.length > 1);
  }

  async apply(messages: Message[]): Promise<Message[]> {
    return messages.map(m => {
      if (!Array.isArray(m.content)) return m;
      // junta text blocks consecutivos
      const collapsed: ContentBlock[] = [];
      for (const block of m.content) {
        const last = collapsed.at(-1);
        if (block.type === 'text' && last?.type === 'text') {
          last.text = `${last.text ?? ''}\n${block.text ?? ''}`;
        } else {
          collapsed.push(block);
        }
      }
      return { ...m, content: collapsed };
    });
  }
}
```

## Integração no loop

📄 `src/query.ts` — adicione antes do `provider.stream`:

```ts
const tokensApprox = estimateTokens(messages);
for (const strat of compactStrategies) {
  if (strat.shouldRun(messages, tokensApprox)) {
    messages = await strat.apply(messages);
    break;
  }
}

function estimateTokens(msgs: Message[]): number {
  return JSON.stringify(msgs).length / 4; // heurística grosseira
}
```

## Quando rodar cada estratégia

| Sintoma | Use |
|---|---|
| Contexto > 70% do max | autoCompact |
| Muitos tool_results truncados/órfãos | snip |
| Ínumeros blocos de text pequenos | collapse |
| Tudo acima | rode em ordem: snip → collapse → auto |

## Anti-padrões

- ❌ Compactar a cada turno (custo + perde fidelidade).
- ❌ Resumir o turno **atual** (perde tool_call em curso).
- ❌ Resumo agressivo que apaga decisões (use prompt de resumo conservador).
- ❌ `compact_boundary` perdido entre runs (re-resume tudo).

## ✓ Validar

```ts
import { AutoCompactStrategy } from './compact/auto.js';

const strat = new AutoCompactStrategy(provider, 100);
const long = Array.from({ length: 30 }, (_, i) => ({
  role: i % 2 ? 'assistant' : 'user', content: `msg ${i}`,
}));
const shortened = await strat.apply(long as any);
expect(shortened.length).toBeLessThan(long.length);
```

## Próximo

→ [s07. Persistent Tasks — grafo de tarefas em disco](s07-persistent-tasks.md)
