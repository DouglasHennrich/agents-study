import { describe, it, expect, beforeEach } from 'vitest';
import { runCoordinator } from '../src/coordinator/loop.js';
import { TaskStore } from '../src/tasks/store.js';
import { createTeammate, resetTeammates, getTeammate } from '../src/teams/teammate.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { MockProvider } from '../src/provider/mock.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

beforeEach(() => resetTeammates());

describe('coordinator (s11)', () => {
  it('atribui task pendente ao teammate livre', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cm-coord-'));
    const store = new TaskStore(dir);
    const t = await store.create({ title: 'work it' });

    const provider = new MockProvider([{ text: `DONE task ${t.id}` }]);
    createTeammate({
      name: 'worker', role: 'worker', systemPrompt: '', tools: new ToolRegistry(),
    });

    const res = await runCoordinator({
      provider, store, idleMs: 10, maxIdleCycles: 2, maxIterations: 6,
    });
    expect(res.iterations).toBeGreaterThan(0);

    const final = await store.get(t.id);
    expect(['in_progress', 'completed']).toContain(final.status);
    expect(final.assignee).not.toBeNull();
    await rm(dir, { recursive: true });
  });
});
