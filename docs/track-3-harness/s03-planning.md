# s03. Planning — Plan Mode + Todo

> *"Um agente sem plano vagueia."* Listar passos antes de executar **dobra** a taxa de conclusão em tarefas complexas.

## Como Claude Code faz

📂 `src/tools/EnterPlanModeTool/`, `ExitPlanModeTool/`, `TodoWriteTool/`

- **Plan Mode** — estado especial onde o modelo **não pode** chamar tools destrutivas. Só lê, pesquisa, escreve plano. Sai com `ExitPlanModeTool`.
- **TodoWriteTool** — substitui um array de `{id, content, status}` na memória do agent. O modelo atualiza marcando in_progress / completed conforme avança.

## Por que funciona

1. **Compromisso público** — o modelo se compromete com uma sequência ANTES de executar.
2. **Contexto de progresso** — ler "3/10 done" reduz drift mid-tarefa.
3. **Recuperação** — se algo falha, o modelo sabe **onde estava**.

## Versão didática

📄 `src/tools/plan-mode.ts`

```ts
import { z } from 'zod';
import { buildTool } from './registry.js';

let planMode = false;
let currentPlan: string | null = null;

export const enterPlanModeTool = buildTool({
  name: 'enter_plan_mode',
  description: 'Entra em modo de planejamento. Tools destrutivas ficam bloqueadas. Use para tarefas complexas.',
  schema: z.object({}),
  isReadOnly: true,
  async call() {
    planMode = true;
    return { mode: 'plan', message: 'Plan mode ativo. Apenas read/search permitidos.' };
  },
});

export const exitPlanModeTool = buildTool({
  name: 'exit_plan_mode',
  description: 'Sai do plan mode após apresentar plano completo. Argumento: o plano em Markdown.',
  schema: z.object({
    plan: z.string().describe('Plano em Markdown com passos numerados'),
  }),
  isReadOnly: true,
  async call({ plan }) {
    planMode = false;
    currentPlan = plan;
    return { mode: 'execute', plan };
  },
});

export function isPlanMode(): boolean { return planMode; }
export function getCurrentPlan(): string | null { return currentPlan; }
```

📄 `src/tools/todo.ts`

```ts
import { z } from 'zod';
import { buildTool } from './registry.js';

interface TodoItem {
  id: number;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

let todos: TodoItem[] = [];

export const todoWriteTool = buildTool({
  name: 'todo_write',
  description: 'Substitui a lista de TODOs do agent. Use para planejar e marcar progresso. Marque APENAS UM como in_progress por vez.',
  schema: z.object({
    items: z.array(z.object({
      id: z.number(),
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed']),
    })),
  }),
  isReadOnly: true,
  async call({ items }) {
    const inProgress = items.filter(i => i.status === 'in_progress');
    if (inProgress.length > 1) {
      return { error: 'apenas 1 todo pode estar in_progress por vez' };
    }
    todos = items;
    return { count: items.length, summary: items.map(i =>
      `${i.status === 'completed' ? '✓' : i.status === 'in_progress' ? '▶' : '○'} ${i.content}`
    ).join('\n') };
  },
});

export function getTodos(): TodoItem[] { return todos; }
```

## Bloquear tools destrutivas em plan mode

📄 `src/tools/registry.ts` — adicionar guard global em `execute()`:

```ts
import { isPlanMode } from './plan-mode.js';

async execute(name, rawInput) {
  const tool = this.tools.get(name);
  if (!tool) return { output: `unknown tool: ${name}`, is_error: true };

  if (isPlanMode() && tool.isDestructive) {
    return {
      output: `❌ tool ${name} bloqueada em plan mode. Saia com exit_plan_mode primeiro.`,
      is_error: true,
    };
  }
  // ... resto igual
}
```

## System prompt atualizado

```ts
const systemPrompt = `Você é o claude-mini.

Para tarefas com 3+ passos:
1. Chame enter_plan_mode
2. Investigue (read_file, grep, glob — não escreve nada)
3. Use todo_write para listar passos
4. Chame exit_plan_mode com o plano final
5. Execute, atualizando todo_write a cada passo

Apenas 1 todo pode estar in_progress por vez.`;
```

## ✓ Validar

```bash
npm run dev -- chat "Adicione um novo endpoint /health no servidor express deste projeto"
```

Você vê o agent:

1. `enter_plan_mode` → bloqueia bash destrutivo
2. `read_file package.json`, `grep "express"`...
3. `todo_write [...3 itens...]`
4. `exit_plan_mode plano="..."`
5. Atualiza todo enquanto executa.

## Próximo

→ [s04. Sub-Agents — fork + contexto limpo](s04-sub-agents.md)
