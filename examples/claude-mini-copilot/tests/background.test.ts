import { describe, it, expect } from 'vitest';
import { spawnBg, getBg, readBgLog, listBg, resetBg, configureBgDir } from '../src/tasks/background.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('background tasks (s08)', () => {
  it('roda comando em background e captura output', async () => {
    resetBg();
    configureBgDir(await mkdtemp(join(tmpdir(), 'cm-bg-')));
    const t = await spawnBg('echo hello-from-bg');
    expect(t.status).toBe('running');
    expect(listBg()).toHaveLength(1);

    // espera processo terminar (echo é instantâneo)
    for (let i = 0; i < 30; i++) {
      const cur = getBg(t.id)!;
      if (cur.status !== 'running') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const final = getBg(t.id)!;
    expect(final.status).toBe('done');
    expect(final.exit_code).toBe(0);
    const log = await readBgLog(t.id);
    expect(log).toContain('hello-from-bg');
  });
});
