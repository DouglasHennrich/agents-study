import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../src/tools/registry.js';
import { builtinTools, squadMemory } from '../src/tools/builtin.js';

describe('ToolRegistry', () => {
  const ctx = { sessionId: 's1', agentName: 'a' };

  it('registra e executa uma tool simples', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'echo',
      description: 'echo',
      input: z.object({ msg: z.string() }),
      async run({ msg }) {
        return msg;
      },
    });
    const r = await reg.run('echo', { msg: 'hi' }, ctx);
    expect(r).toEqual({ ok: true, value: 'hi' });
  });

  it('rejeita args inválidos', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'sum',
      description: '',
      input: z.object({ a: z.number(), b: z.number() }),
      async run({ a, b }) {
        return a + b;
      },
    });
    const r = await reg.run('sum', { a: '1', b: 2 }, ctx);
    expect(r.ok).toBe(false);
  });

  it('expõe schemas em formato JSON Schema', () => {
    const reg = new ToolRegistry();
    builtinTools.forEach((t) => reg.register(t));
    const schemas = reg.schemas();
    expect(schemas.find((s) => s.name === 'squad_route')).toBeDefined();
    expect(schemas[0].parameters).toHaveProperty('type', 'object');
  });

  it('squad_memory persiste entre chamadas no processo', async () => {
    const reg = new ToolRegistry();
    reg.register(squadMemory);
    await reg.run('squad_memory', { op: 'set', key: 'k', value: 42 }, ctx);
    const r = await reg.run('squad_memory', { op: 'get', key: 'k' }, ctx);
    expect(r).toEqual({ ok: true, value: { ok: true, result: 42 } });
  });
});
