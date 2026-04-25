# claude-mini

Versão didática de um harness estilo **Claude Code**, construída como acompanhamento da [Trilha 3 do tutorial](../../docs/track-3-harness/README.md).

> **Não é um clone.** É uma reimplementação minimalista (~1.5K linhas) cobrindo os 12 mecanismos progressivos para você estudar arquitetura, não para usar em produção.

## Setup

```bash
cd examples/claude-mini
npm install
npm test
```

## Rodar a CLI

Sem chave de API (usa MockProvider):

```bash
npm run dev -- chat "olá"
```

Com Anthropic real:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev -- chat "liste os arquivos .ts neste projeto"
```

## Estrutura

```
src/
├── provider/
│   ├── types.ts          interface LlmProvider
│   ├── mock.ts           provider determinístico para testes
│   └── anthropic.ts      adapter para Anthropic API (opcional)
├── query.ts              s01 — main loop AsyncGenerator
├── tools/
│   ├── registry.ts       s02 — buildTool factory + ToolRegistry
│   ├── plan-mode.ts      s03 — estado global do plan mode
│   └── builtin.ts        file_read, file_write, bash, glob, grep, todo
├── agents/fork.ts        s04 — sub-agents isolados
├── skills/loader.ts      s05 — skill loader (~/.claude-mini/skills)
├── compact/strategies.ts s06 — snip + collapse + auto-summarize
├── tasks/
│   ├── store.ts          s07 — task graph persistido em JSON
│   └── background.ts     s08 — bash daemons com PID e log
├── teams/teammate.ts     s09 + s10 — InProcessTeammate + sendMessage
├── coordinator/loop.ts   s11 — modo autônomo
├── worktree/manager.ts   s12 — git worktree por agent
└── cli/index.ts          REPL/CLI thin wrapper
tests/                    9 suítes vitest, sem deps externas
```

## Mapeamento → capítulos da Trilha 3

| Capítulo | Arquivo |
|---|---|
| [s00](../../docs/track-3-harness/s00-setup-e-provider-llm.md) | `package.json`, `src/provider/*` |
| [s01](../../docs/track-3-harness/s01-the-loop.md) | `src/query.ts` |
| [s02](../../docs/track-3-harness/s02-tool-dispatch.md) | `src/tools/registry.ts`, `src/tools/builtin.ts` |
| [s03](../../docs/track-3-harness/s03-planning.md) | `src/tools/plan-mode.ts`, `enterPlanModeTool` em `builtin.ts` |
| [s04](../../docs/track-3-harness/s04-sub-agents.md) | `src/agents/fork.ts` |
| [s05](../../docs/track-3-harness/s05-skills-on-demand.md) | `src/skills/loader.ts` |
| [s06](../../docs/track-3-harness/s06-context-compression.md) | `src/compact/strategies.ts` |
| [s07](../../docs/track-3-harness/s07-persistent-tasks.md) | `src/tasks/store.ts` |
| [s08](../../docs/track-3-harness/s08-background-tasks.md) | `src/tasks/background.ts` |
| [s09](../../docs/track-3-harness/s09-teams.md) | `src/teams/teammate.ts` |
| [s10](../../docs/track-3-harness/s10-team-protocols.md) | `sendMessage` em `teammate.ts` |
| [s11](../../docs/track-3-harness/s11-autonomous-mode.md) | `src/coordinator/loop.ts` |
| [s12](../../docs/track-3-harness/s12-worktree-isolation.md) | `src/worktree/manager.ts` |

## Limitações conhecidas

- **Sem prompt cache** — Anthropic real fica caro em sessões longas.
- **Sem streaming SSE** — `AnthropicProvider` usa request síncrono e simula stream.
- **Worktree merge** — não trata conflitos de merge.
- **Coordinator** — matching de role↔task é trivial (primeiro disponível).
- **Teammate fork** — só in-process; sem `child_process.fork()`.

## Próximos passos sugeridos

1. Substituir `AnthropicProvider` por streaming SSE real (`text/event-stream`).
2. Adicionar prompt cache (`cache_control: { type: 'ephemeral' }` nos system blocks).
3. Implementar `agent_tool` que use `runSubAgent` para o modelo despachar sub-agents.
4. Persistir mensagens em JSONL (`~/.claude-mini/sessions/<id>.jsonl`).
5. Adicionar permission system (`canUseTool` callback antes de executar destrutivos).
