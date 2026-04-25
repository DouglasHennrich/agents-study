// Persistent task store (s07)
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
  constructor(public dir: string) {}
  async init(): Promise<void> { await mkdir(this.dir, { recursive: true }); }
  newId(): string { return `t_${randomBytes(4).toString('hex')}`; }

  async create(input: { title: string; dependencies?: string[]; payload?: Record<string, unknown> }): Promise<Task> {
    await this.init();
    const now = new Date().toISOString();
    const t: Task = {
      id: this.newId(),
      title: input.title,
      status: 'pending',
      dependencies: input.dependencies ?? [],
      assignee: null,
      payload: input.payload ?? {},
      log: [],
      created_at: now,
      updated_at: now,
    };
    await this.persist(t);
    return t;
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
    const files = (await readdir(this.dir)).filter((f) => f.endsWith('.json'));
    const tasks = await Promise.all(files.map((f) => this.get(f.replace(/\.json$/, ''))));
    return tasks.filter(
      (t) => (!filter?.status || t.status === filter.status)
          && (!filter?.assignee || t.assignee === filter.assignee),
    );
  }

  private async persist(t: Task): Promise<void> {
    const final = join(this.dir, `${t.id}.json`);
    const tmp = `${final}.tmp`;
    await writeFile(tmp, JSON.stringify(t, null, 2));
    await rename(tmp, final);
  }
}
