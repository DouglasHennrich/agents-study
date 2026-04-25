// Coordinator loop (s11)
import { TaskStore, type Task } from '../tasks/store.js';
import { listTeammates, sendMessage, tickTeammate } from '../teams/teammate.js';
import type { LlmProvider } from '../provider/types.js';

export interface CoordinatorOptions {
  provider: LlmProvider;
  store: TaskStore;
  idleMs?: number;
  maxIdleCycles?: number;
  maxIterations?: number;     // safety bound (testes)
}

export async function runCoordinator(opts: CoordinatorOptions): Promise<{ iterations: number }> {
  const idle = opts.idleMs ?? 1000;
  const maxIdle = opts.maxIdleCycles ?? 3;
  const maxIter = opts.maxIterations ?? Infinity;
  let idleStreak = 0;
  let iter = 0;

  while (iter < maxIter) {
    iter++;
    const tasks = await opts.store.list();
    const ready = tasks.filter(
      (t) => t.status === 'pending' && depsSatisfied(t, tasks) && !t.assignee,
    );
    const free = listTeammates().filter((tm) => !tm.busy);
    let work = false;

    for (const task of ready) {
      const tm = free.shift();
      if (!tm) break;
      await opts.store.update(task.id, {
        assignee: tm.id, status: 'in_progress',
        log: [{ at: new Date().toISOString(), msg: `assigned to ${tm.name}` }],
      });
      sendMessage({
        from: 'coordinator', to: tm.id,
        body: `[task ${task.id}] ${task.title}`, awaitReply: false, provider: opts.provider,
      }).catch(() => {});
      work = true;
    }

    for (const tm of listTeammates()) {
      await tickTeammate(tm.id, opts.provider);
      while (tm.outbox.length > 0) {
        const msg = tm.outbox.shift()!;
        const text = typeof msg.content === 'string' ? msg.content : '';
        const m = /DONE\s+task\s+(t_\w+)/.exec(text);
        if (m) {
          await opts.store.update(m[1], { status: 'completed' });
          work = true;
        }
      }
    }

    if (work) idleStreak = 0; else idleStreak++;
    if (idleStreak >= maxIdle) break;
    await new Promise((r) => setTimeout(r, idle));
  }
  return { iterations: iter };
}

function depsSatisfied(task: Task, all: Task[]): boolean {
  if (task.dependencies.length === 0) return true;
  const byId = new Map(all.map((t) => [t.id, t]));
  return task.dependencies.every((d) => byId.get(d)?.status === 'completed');
}
