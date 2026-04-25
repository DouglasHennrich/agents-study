# s11. Autonomous Mode — coordinator loop

> *"Tirando o humano do loop."* Em vez do agent esperar input, o coordinator olha tasks pendentes e auto-despacha.

## Como Claude Code faz

📂 `src/coordinator/coordinatorMode.ts`, `src/coordinator/idleCycle.ts`

```
loop:
  1. tasks = TaskStore.list({ status: 'pending', dependencies_satisfied: true })
  2. teammates = listTeammates({ busy: false })
  3. for each (task, suitable_teammate):
        - assign + send_message
  4. tickAllTeammates()
  5. process bg notifications
  6. sleep(idle_ms)
```

Regras críticas:

- **Idempotência** — se task já tem `assignee`, pula.
- **Backoff** — task `failed` 3x vai pra `blocked` (não loopa pra sempre).
- **Watchdog** — teammate ocupado > N min reset.
- **Stop conditions** — sem tasks pendentes E sem teammates ocupados E sem bg pendente → exit.

## Versão didática

📄 `src/coordinator/loop.ts`

```ts
import { TaskStore, type Task } from '../tasks/store.js';
import { listTeammates, tickTeammate, getTeammate } from '../teams/teammate.js';
import { sendMessage } from '../teams/protocol.js';
import type { LlmProvider } from '../provider/types.js';

export interface CoordinatorOptions {
  provider: LlmProvider;
  store: TaskStore;
  idleMs?: number;
  maxIdleCycles?: number;       // exit se ficar idle X ciclos seguidos
}

export async function runCoordinator(opts: CoordinatorOptions) {
  const idle = opts.idleMs ?? 1500;
  const maxIdle = opts.maxIdleCycles ?? 5;
  let idleStreak = 0;

  while (true) {
    const tasks = await opts.store.list({ status: 'pending' });
    const ready = tasks.filter(t => depsSatisfied(t, tasks));
    const free = listTeammates().filter(tm => !tm.busy);

    let didWork = false;

    for (const task of ready) {
      if (task.assignee) continue;
      const tm = pickTeammate(task, free);
      if (!tm) continue;
      await opts.store.update(task.id, {
        assignee: tm.id,
        status: 'in_progress',
        log: [{ at: new Date().toISOString(), msg: `assigned to ${tm.name}` }],
      });
      sendMessage({
        from: 'coordinator', to: tm.id,
        body: `[task ${task.id}] ${task.title}\nPayload: ${JSON.stringify(task.payload)}`,
        awaitReply: false, provider: opts.provider,
      }).catch(() => {});
      didWork = true;
    }

    for (const tm of listTeammates()) {
      await tickTeammate(tm.id, opts.provider);
      // se outbox tem mensagem com "DONE task <id>", marca completed
      while (tm.outbox.length > 0) {
        const msg = tm.outbox.shift()!;
        const text = typeof msg.content === 'string' ? msg.content : '';
        const m = /DONE\s+task\s+(t_\w+)/.exec(text);
        if (m) {
          await opts.store.update(m[1], { status: 'completed' });
          didWork = true;
        }
      }
    }

    if (didWork) idleStreak = 0; else idleStreak++;
    if (idleStreak >= maxIdle) {
      console.log('[coordinator] sem trabalho — saindo');
      break;
    }
    await new Promise(r => setTimeout(r, idle));
  }
}

function depsSatisfied(task: Task, all: Task[]): boolean {
  if (task.dependencies.length === 0) return true;
  const byId = new Map(all.map(t => [t.id, t]));
  return task.dependencies.every(d => byId.get(d)?.status === 'completed');
}

function pickTeammate(_task: Task, free: any[]) {
  // simples: primeiro disponível. Real: matching role↔task.payload.role
  return free[0];
}
```

## CLI

📄 `src/cli/coordinate.ts`

```ts
import { Command } from 'commander';
import { runCoordinator } from '../coordinator/loop.js';
import { TaskStore } from '../tasks/store.js';
import { AnthropicProvider } from '../provider/anthropic.js';

export const coordinateCmd = new Command('coordinate')
  .description('Roda em modo autônomo até esgotar tasks')
  .option('--idle-ms <n>', 'intervalo entre ciclos', '2000')
  .action(async (opts) => {
    await runCoordinator({
      provider: new AnthropicProvider(),
      store: new TaskStore(`${process.env.HOME}/.claude-mini/tasks`),
      idleMs: Number(opts.idleMs),
    });
  });
```

## Anti-padrões

- ❌ Coordinator sem stop condition → loop infinito + custos.
- ❌ Pickup sem matching de role → reviewer codifica, coder revisa, caos.
- ❌ Sem backoff → tasks falhando ciclam pra sempre.
- ❌ Sem audit log (`log[]` da task) → sessão perdida e ninguém sabe o que aconteceu.

## ✓ Validar

```bash
# pré-popule tasks via outro chat:
npm run dev -- chat "Crie 3 tasks: indexar, linter, gerar-relatorio"
# rode autônomo:
npm run dev -- coordinate
```

## Próximo

→ [s12. Worktree Isolation — git worktree por task](s12-worktree-isolation.md)
