import { describe, it, expect, beforeEach } from 'vitest';
import { TaskStore } from '../src/tasks/store.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dir: string;
let store: TaskStore;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cm-tasks-'));
  store = new TaskStore(dir);
});

describe('task store (s07)', () => {
  it('cria, atualiza e lista tasks', async () => {
    const t = await store.create({ title: 'compilar' });
    expect(t.status).toBe('pending');
    await store.update(t.id, { status: 'in_progress', log: [{ at: new Date().toISOString(), msg: 'iniciado' }] });
    const fresh = await store.get(t.id);
    expect(fresh.status).toBe('in_progress');
    expect(fresh.log).toHaveLength(1);
    const all = await store.list();
    expect(all).toHaveLength(1);
    await rm(dir, { recursive: true });
  });

  it('filtra por status', async () => {
    await store.create({ title: 'a' });
    const b = await store.create({ title: 'b' });
    await store.update(b.id, { status: 'completed' });
    const pendentes = await store.list({ status: 'pending' });
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].title).toBe('a');
    await rm(dir, { recursive: true });
  });
});
