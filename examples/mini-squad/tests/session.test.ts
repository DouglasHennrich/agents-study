import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CastingEngine } from '../src/casting/casting-engine.js';
import { SessionPool } from '../src/session/session.js';
import { FileStorage, InMemoryStorage } from '../src/storage/index.js';

const charter = {
  name: 'TestAgent',
  role: 'agente de teste',
  tools: ['squad_memory'],
};

describe('SessionPool', () => {
  it('cria sessão com system prompt do charter', async () => {
    const eng = new CastingEngine();
    const a = eng.castAgent(charter);
    const pool = new SessionPool();
    const s = await pool.create(a);
    expect(s.messages[0].role).toBe('system');
    expect(s.messages[0].content).toContain('TestAgent');
    expect(s.status).toBe('idle');
  });

  it('persiste e resume com FileStorage (crash recovery)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mini-squad-'));
    const eng = new CastingEngine();
    const a = eng.castAgent(charter);

    // Simula primeira execução
    const storage1 = new FileStorage(dir);
    const pool1 = new SessionPool(storage1);
    const s1 = await pool1.create(a);
    await pool1.appendMessages(s1.id, [{ role: 'user', content: 'oi' }]);

    // "Crash" — segundo processo só conhece o storage
    const storage2 = new FileStorage(dir);
    const pool2 = new SessionPool(storage2);
    const s2 = await pool2.resume(s1.id);
    expect(s2.id).toBe(s1.id);
    expect(s2.messages.at(-1)?.content).toBe('oi');
  });

  it('InMemoryStorage também suporta resume dentro do mesmo processo', async () => {
    const eng = new CastingEngine();
    const a = eng.castAgent(charter);
    const storage = new InMemoryStorage();
    const pool = new SessionPool(storage);
    const s = await pool.create(a);

    const pool2 = new SessionPool(storage);
    const r = await pool2.resume(s.id);
    expect(r.id).toBe(s.id);
  });
});
