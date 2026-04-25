# t04. Reaproveitando os 12 mecanismos

## TL;DR

| Mecanismo | Funciona como está? | Observação |
|---|---|---|
| s01 — The Loop | 🟡 adaptado (t02) | mudou só detecção de tool_calls |
| s02 — Tool Dispatch | 🟢 igual | só `toSpecs()` muda |
| s03 — Plan Mode | 🟢 igual | guard global é provider-agnostic |
| s04 — Sub-Agents | 🟢 igual | usa `runQuery` adaptado |
| s05 — Skills on Demand | 🟢 igual | `SkillLoader` é só I/O |
| s06 — Compaction | 🟡 ajuste mínimo | snip precisa olhar `tool_calls`/`tool_call_id` |
| s07 — Tasks | 🟢 igual | persistência pura |
| s08 — Background | 🟢 igual | shell daemons |
| s09 — Teams | 🟢 igual | `tickTeammate` chama `runQuery` adaptado |
| s10 — Protocols | 🟢 igual | `sendMessage`/mailbox |
| s11 — Coordinator | 🟢 igual | regex `DONE task` no outbox |
| s12 — Worktrees | 🟢 igual | git puro |

**10 de 12 mecanismos são copy-paste do `claude-mini`.**

## Os 2 que precisam atenção

### 1. Snip compaction (s06)

A versão do `claude-mini` removia tool_results órfãos olhando blocos:

```ts
// claude-mini (T3)
const orphan = m.content.some(
  (b: ContentBlock) => b.type === 'tool_result' && !b.tool_use_id,
);
```

Em T4, "órfão" = mensagem `role:"tool"` cujo `tool_call_id` não casa com nenhuma `assistant.tool_calls[].id` anterior:

```ts
// claude-mini-copilot (T4)
const validIds = new Set<string>();
for (const m of messages) {
  if (m.role === 'assistant' && m.tool_calls) {
    for (const tc of m.tool_calls) validIds.add(tc.id);
  }
}
return messages.filter((m) => {
  if (m.role === 'tool' && m.tool_call_id && !validIds.has(m.tool_call_id)) return false;
  if (typeof m.content === 'string' && !m.content.trim() && !m.tool_calls?.length) return false;
  return true;
});
```

E **cuidado com snip que quebra par**: se você remove um `assistant` com `tool_calls`, precisa remover também os `role:"tool"` correspondentes — senão o próximo POST vira 400.

### 2. Sub-agent + main usando o mesmo mailbox?

Não há mudança técnica, mas **comportamento**: GPT-4o-mini tem latência menor que Sonnet, então o coordinator vê tasks completarem **muito mais rápido**. Aumente `idleMs` para evitar busy-wait inútil.

## Reuso de código entre os dois exemplos

Tudo que vive em diretórios **abaixo** começam idênticos:

```
src/
├── skills/loader.ts          ← copy-paste exato
├── tasks/store.ts            ← copy-paste exato
├── tasks/background.ts       ← copy-paste exato
├── coordinator/loop.ts       ← copy-paste exato
└── worktree/manager.ts       ← copy-paste exato
```

E quase igual:

```
src/
├── agents/fork.ts            ← idêntico (delega ao runQuery)
├── compact/strategies.ts     ← snip adaptado, resto igual
├── teams/teammate.ts         ← idêntico (delega ao runQuery)
└── tools/registry.ts         ← `toSpecs()` muda; resto igual
```

E só estes mudam de verdade:

```
src/
├── provider/types.ts         ← formato OpenAI Message
├── provider/copilot.ts       ← novo, substitui anthropic.ts
├── provider/mock.ts          ← novo formato
├── query.ts                  ← loop com tool_calls
├── tools/builtin.ts          ← idêntico (Zod), só `defaultRegistry()` igual
└── cli/index.ts              ← troca provider default
```

## Conclusão arquitetural

> O harness do Claude Code **não é** sobre Anthropic. É sobre os **padrões**:
> loop, tool dispatch, plan mode, sub-agents, compaction, persistência, teams.
>
> Esses padrões são **provider-agnostic**. O LLM é só o "motor" — a engenharia
> está em volta dele.

Por isso `claude-mini-copilot` é praticamente **gratuito de construir** depois que `claude-mini` existe: você troca 4 arquivos e ganha o mesmo poder.

## Próximo

→ [t05. Setup, autenticação e uso](t05-setup-e-uso.md)
