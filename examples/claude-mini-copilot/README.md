# claude-mini-copilot

Harness didático **estilo Claude Code** usando **GitHub Copilot** como LLM (formato OpenAI Chat Completions).

> Espelho do [`claude-mini`](../claude-mini/) com `LlmProvider` adaptado para o `@github/copilot-sdk`. Mesmas 12 mecânicas (loop, plan mode, sub-agents, compaction, tasks, background, teams, protocols, coordinator, worktrees), 4 arquivos diferentes.

📚 Documentação: [Trilha 4 — Harness com Copilot](../../docs/track-4-harness-copilot/README.md)

## Setup

```bash
npm install
npm test           # 19/19 tests offline (MockProvider)

# Modo real:
export COPILOT_TOKEN="$(gh auth token)"   # ou seu token Copilot
npm run dev -- chat "liste os arquivos .ts e me diga quantos são"
```

## Estrutura

```
src/
├── provider/
│   ├── types.ts            ← OpenAI-style Message/ToolCall
│   ├── copilot.ts          ← wrapper sobre @github/copilot-sdk
│   └── mock.ts             ← MockProvider para testes
├── query.ts                ← The Loop adaptado (tool_calls + role:"tool")
├── tools/
│   ├── registry.ts         ← toSpecs() formato OpenAI
│   ├── plan-mode.ts
│   └── builtin.ts          ← file_read, bash, glob, grep, todo_write...
├── agents/fork.ts          ← sub-agents
├── compact/strategies.ts   ← snip / collapse / auto
├── tasks/                  ← persistência + background
├── teams/teammate.ts       ← teammates in-process
├── coordinator/loop.ts     ← bus de tasks
├── worktree/manager.ts     ← git worktree
├── skills/loader.ts        ← skills sob demanda
└── cli/index.ts            ← `claude-mini-copilot chat ...`
```

## Diferenças vs claude-mini (Anthropic)

| Coisa | claude-mini | claude-mini-copilot |
|---|---|---|
| Provider | `AnthropicProvider` (Messages API) | `CopilotProvider` (Chat Completions) |
| System prompt | parâmetro `system` | `messages[0]` |
| Tool call | `content[].type='tool_use'` | `assistantMsg.tool_calls[]` |
| Tool result | bloco `tool_result` em msg `user` | msg `role:"tool"` com `tool_call_id` |
| Stop reason | `stop_reason: 'end_turn'\|'tool_use'` | `finish_reason: 'stop'\|'tool_calls'` |
| Tool spec | `{name, description, input_schema}` | `{name, description, parameters}` (+ wrapping no provider) |
| Token | `ANTHROPIC_API_KEY` | `COPILOT_TOKEN` |
| Modelo padrão | `claude-sonnet-4-5` | `gpt-4o-mini` |

10 dos 12 mecanismos são **copy-paste** de `claude-mini`. Apenas o loop (`query.ts`) e o snip de compaction precisam tratar `tool_call_id`/`tool_calls`.

## Comandos

```bash
npm install         # instala deps
npm test            # roda vitest (19 tests offline)
npm run dev -- ...  # tsx (CLI direto)
npm run build       # tsc
```

## Variáveis de ambiente

| Var | Padrão | Uso |
|---|---|---|
| `COPILOT_TOKEN` | — | Token GitHub Copilot. Sem ele, usa MockProvider. |
| `COPILOT_MODEL` | `gpt-4o-mini` | Modelo a usar. |

## Limitações

- Sem prompt cache (Copilot/OpenAI não expõem `cache_control`).
- Sem extended thinking (Anthropic only).
- Streaming "fakeado" (request `stream:false` + emite 1 delta). Para SSE real, edite `CopilotProvider.stream()`.
- Token Copilot pode expirar — implemente refresh para daemons longos.

## Por onde começar a ler

1. [`src/provider/types.ts`](src/provider/types.ts) — tipos OpenAI.
2. [`src/provider/copilot.ts`](src/provider/copilot.ts) — adapter sobre o SDK.
3. [`src/query.ts`](src/query.ts) — loop com tool_calls.
4. [`src/tools/builtin.ts`](src/tools/builtin.ts) — tools (idênticas ao claude-mini).
5. Cap. [t02 do tutorial](../../docs/track-4-harness-copilot/t02-loop-adaptado.md) — explicação do diff.
