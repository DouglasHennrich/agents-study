# s07. Persistent Tasks — grafo de tarefas em disco

> *"Objetivos grandes → tarefas pequenas → disco."* TODOs em memória somem; tarefas em arquivo sobrevivem a crash, multi-sessão, e múltiplos agents.

## Como Claude Code faz

📂 `src/tools/TaskCreate/Update/Get/List`, `src/tasks/`

- Cada task: `{ id, title, status, dependencies[], assignee, payload, log[] }`.
- Persistido em `~/.claude/projects/<hash>/tasks/<id>.json`.
- IDs com prefixo: `t_xxxxxxxx` (task), `a_xxxxxxxx` (agent), `b_xxxxxxxx` (bash) — facilita logs.
- Status flow: `pending → in_progress → completed | blocked | failed`.

## Versão didática

📄 `src/tasks/store.ts`

```ts
import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'failed']),
  dependencies: z.array(z.string()).default([]),
  assignee: z.string().nullable().default(null),
  payload: z.record(z.unknown()).default({}),
  log: z.array(z.object({ at: z.string(), msg: z.string() })).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Task = z.infer<typeof taskSchema>;

export class TaskStore {
  constructor(private dir: string) {}

  async init() { await mkdir(this.dir, { recursive: true }); }

  newId(): string { return `t_${randomBytes(4).toString('hex')}`; }

  async create(input: { title: string; dependencies?: string[]; payload?: object }): Promise<Task> {
    await this.init();
    const now = new Date().toISOString();
    const task: Task = {
      id: this.newId(),
      title: input.title,
      status: 'pending',
      dependencies: input.dependencies ?? [],
      assignee: null,
      payload: (input.payload as any) ?? {},
      log: [],
      created_at: now,
      updated_at: now,
    };
    await this.persist(task);
    return task;
  }

  async update(id: string, patch: Partial<Task>): Promise<Task> {
    const cur = await this.get(id);
    const next: Task = { ...cur, ...patch, updated_at: new Date().toISOString() };
    if (patch.log) next.log = [...cur.log, ...patch.log];
    await this.persist(next);
    return next;
  }

  async get(id: string): Promise<Task> {
    const raw = await readFile(join(this.dir, `${id}.json`), 'utf-8');
    return taskSchema.parse(JSON.parse(raw));
  }

  async list(filter?: { status?: Task['status']; assignee?: string }): Promise<Task[]> {
    await this.init();
    const files = (await readdir(this.dir)).filter(f => f.endsWith('.json'));
    const tasks = await Promise.all(files.map(f => this.get(f.replace(/\.json$/, ''))));
    return tasks.filter(t =>
      (!filter?.status || t.status === filter.status) &&
      (!filter?.assignee || t.assignee === filter.assignee)
    );
  }

  private async persist(task: Task) {
    const final = join(this.dir, `${task.id}.json`);
    const tmp = `${final}.tmp`;
    await writeFile(tmp, JSON.stringify(task, null, 2));
    await rename(tmp, final);
  }
}
```

## Tools

📄 `src/tools/builtin/task.ts`

```ts
import { z } from 'zod';
import { buildTool } from '../registry.js';
import { TaskStore } from '../../tasks/store.js';

const store = new TaskStore(`${process.env.HOME}/.claude-mini/tasks`);

export const taskCreateTool = buildTool({
  name: 'task_create',
  description: 'Cria uma task persistente. Use para tarefas que vão durar múltiplos turnos ou serem retomadas.',
  schema: z.object({
    title: z.string(),
    dependencies: z.array(z.string()).optional(),
    payload: z.record(z.unknown()).optional(),
  }),
  async call(input) { return await store.create(input); },
});

export const taskUpdateTool = buildTool({
  name: 'task_update',
  description: 'Atualiza status/log de uma task. Use ao começar (in_progress), ao concluir, ou ao bloquear.',
  schema: z.object({
    id: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'failed']).optional(),
    log_msg: z.string().optional(),
  }),
  async call({ id, status, log_msg }) {
    const patch: any = {};
    if (status) patch.status = status;
    if (log_msg) patch.log = [{ at: new Date().toISOString(), msg: log_msg }];
    return await store.update(id, patch);
  },
});

export const taskListTool = buildTool({
  name: 'task_list',
  description: 'Lista tasks. Filtre por status para ver pendentes, em progresso etc.',
  schema: z.object({
    status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'failed']).optional(),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  async call({ status }) { return await store.list({ status }); },
});
```

## Por que disco?

| Memória (TODO Write) | Disco (Tasks) |
|---|---|
| some no fim da sessão | sobrevive a crash |
| 1 agent vê | múltiplos agents compartilham |
| sem dependências | grafo (`dependencies[]`) |
| sem audit trail | `log[]` por task |

## Anti-padrões

- ❌ Task pra coisa de 1 turno (use TODOs em memória).
- ❌ `payload` enorme (vira lentidão de I/O). Salve em arquivo separado, referencie path.
- ❌ Sem `dependencies[]` em workflow multi-step (ordem indefinida).
- ❌ Status flow não-monotônico (`completed → in_progress` confunde).

## ✓ Validar

```bash
npm run dev -- chat "Crie 3 tasks: 'compilar', 'testar' (dep compilar), 'deploy' (dep testar). Liste em ordem."
ls ~/.claude-mini/tasks/
cat ~/.claude-mini/tasks/t_*.json | head -20
```

## Próximo

→ [s08. Background Tasks — daemons + notificações](s08-background-tasks.md)
