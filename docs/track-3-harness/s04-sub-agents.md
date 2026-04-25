# s04. Sub-Agents — fork + contexto limpo

> *"Tarefas grandes consomem contexto. Delegue."* Cada sub-agent começa com `messages[]` vazio, devolve só o **resumo** ao agent pai.

## Como Claude Code faz

📂 `src/tools/AgentTool/`, `src/utils/forkSubagent.ts`, `src/tasks/LocalAgentTask/`

```
AgentTool({ description, prompt, model? })
  ├─ in-process (default): executa no mesmo processo, AsyncLocalStorage isola context
  └─ fork: child_process com cache de arquivos compartilhado, messages[] fresco
```

Padrão crítico: **agent pai recebe apenas o `final` do filho**. Toda exploração intermediária (50 turnos? 200KB de contexto?) fica isolada.

## Por que funciona

| Sem sub-agents | Com sub-agents |
|---|---|
| 1 conversa de 50 turnos | 1 turno do pai + 1 sub de 49 turnos |
| Pai vê todo lixo de exploração | Pai vê só "encontrei o bug em foo.ts:42" |
| Compaction agressiva no pai | Pai mantém contexto rico |
| Custo: 50× tokens médios crescentes | Custo: 1 + 49 (igual), mas pai não é poluído |

## Versão didática

📄 `src/agents/fork.ts`

```ts
import { runQuery, type QueryEvent } from '../query.js';
import type { LlmProvider } from '../provider/types.js';
import { ToolRegistry } from '../tools/registry.js';

export interface SubAgentInput {
  description: string;        // p/ logging humano
  prompt: string;             // mensagem inicial do sub
  systemPrompt?: string;
  tools?: ToolRegistry;       // pode ser subset (ex.: só read_only)
  maxTurns?: number;
  provider: LlmProvider;
  model?: string;
}

export interface SubAgentResult {
  summary: string;            // o que volta pro pai
  cost: number;
  turns: number;
  is_error: boolean;
}

export async function runSubAgent(input: SubAgentInput): Promise<SubAgentResult> {
  let summary = '';
  let cost = 0;
  let turns = 0;
  let isError = false;

  for await (const evt of runQuery({
    provider: input.provider,
    prompt: input.prompt,
    systemPrompt: input.systemPrompt,
    tools: input.tools,
    model: input.model,
    maxTurns: input.maxTurns ?? 20,
  })) {
    if (evt.type === 'text' && evt.text) summary += evt.text;
    if (evt.type === 'tool_use') turns++;
    if (evt.type === 'final') cost = evt.cost ?? 0;
    if (evt.type === 'tool_result' && evt.is_error) isError = true;
  }

  return { summary: summary.trim(), cost, turns, is_error: isError };
}
```

## Tool que expõe sub-agents ao modelo

📄 `src/tools/builtin/agent.ts`

```ts
import { z } from 'zod';
import { buildTool } from '../registry.js';
import { runSubAgent } from '../../agents/fork.js';
import { AnthropicProvider } from '../../provider/anthropic.js';
import { ToolRegistry } from '../registry.js';
import { fileReadTool } from './file-read.js';
import { bashTool } from './bash.js';

export const agentTool = buildTool({
  name: 'spawn_agent',
  description: `Cria um sub-agent isolado para uma sub-tarefa.
Use quando: pesquisa exploratória extensa, análise de muitos arquivos, ou tarefas que poluiriam seu contexto.
NÃO use para: 1-2 chamadas simples (faça você mesmo).`,
  schema: z.object({
    description: z.string().describe('Descrição curta da sub-tarefa (1 linha)'),
    prompt: z.string().describe('Prompt completo dado ao sub-agent'),
    read_only: z.boolean().default(true).describe('Se true, sub só lê (sem write/bash)'),
  }),
  isReadOnly: false,
  isConcurrencySafe: true,
  async call({ description, prompt, read_only }) {
    const subTools = new ToolRegistry().register(fileReadTool);
    if (!read_only) subTools.register(bashTool);

    const result = await runSubAgent({
      provider: new AnthropicProvider(),
      prompt,
      systemPrompt: `Você é um sub-agent focado em: ${description}. Responda concisamente — seu output vira a resposta final do pai.`,
      tools: subTools,
    });

    return {
      summary: result.summary,
      turns: result.turns,
      cost: result.cost,
      is_error: result.is_error,
    };
  },
});
```

## Modos de spawning (Claude Code real)

| Modo | Como | Quando |
|---|---|---|
| **default** (in-process) | mesmo node, AsyncLocalStorage isola contexto | leve, share file cache |
| **fork** | `child_process.fork()`, fresh messages[] | isolamento de runtime |
| **worktree** | fork + git worktree (s12) | mexer em files sem afetar pai |
| **remote** | bridge HTTP pra container | escalar fora da máquina |

Nossa versão didática implementa só o **default** (in-process). Os outros são variações de runtime, não de padrão.

## Anti-padrões

- ❌ Sub-agent com tools de write sem necessidade → muta estado fora do controle do pai.
- ❌ Sub-agent sem `maxTurns` → custos descontrolados.
- ❌ Sub-agent retornando JSON gigante → derrota o propósito (pai polui).
- ❌ Recursão sem limite (sub spawn sub spawn...).

## ✓ Validar

```bash
npm run dev -- chat "Investigue todos os arquivos .ts deste projeto e me diga onde estão definidos handlers HTTP"
```

O agent pai deve chamar `spawn_agent` com prompt tipo "encontre handlers HTTP em arquivos .ts" e receber só o resumo.

## Próximo

→ [s05. Skills on Demand — load via `tool_result`](s05-skills-on-demand.md)
