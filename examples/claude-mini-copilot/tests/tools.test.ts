import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, buildTool } from '../src/tools/registry.js';
import { enterPlanMode, exitPlanMode, isPlanMode, resetPlanMode } from '../src/tools/plan-mode.js';
import { z } from 'zod';

beforeEach(() => resetPlanMode());

describe('tool registry (s02 — OpenAI format)', () => {
  it('valida input via zod', async () => {
    const t = buildTool({
      name: 'add',
      description: 'soma',
      schema: z.object({ a: z.number(), b: z.number() }),
      async call({ a, b }) { return a + b; },
    });
    const reg = new ToolRegistry().register(t);
    const ok = await reg.execute('add', { a: 2, b: 3 }, { cwd: process.cwd() });
    expect(ok).toEqual({ output: '5', is_error: false });
    const fail = await reg.execute('add', { a: 'x' }, { cwd: process.cwd() });
    expect(fail.is_error).toBe(true);
  });

  it('toSpecs gera formato OpenAI {name, description, parameters}', () => {
    const t = buildTool({
      name: 'echo',
      description: 'echo',
      schema: z.object({ msg: z.string(), count: z.number().optional() }),
      async call() { return ''; },
    });
    const reg = new ToolRegistry().register(t);
    const specs = reg.toSpecs();
    expect(specs[0]).toMatchObject({
      name: 'echo',
      description: 'echo',
      parameters: {
        type: 'object',
        properties: { msg: { type: 'string' }, count: { type: 'number' } },
        required: ['msg'],
      },
    });
    // não deve incluir o wrapping {type:'function', function:{...}}
    expect((specs[0] as any).type).toBeUndefined();
    expect((specs[0] as any).function).toBeUndefined();
  });
});

describe('plan mode (s03)', () => {
  it('bloqueia tools destrutivas em plan mode', async () => {
    const writer = buildTool({
      name: 'write',
      description: 'write',
      schema: z.object({}),
      isDestructive: true,
      async call() { return 'wrote'; },
    });
    const reg = new ToolRegistry().register(writer);
    enterPlanMode();
    expect(isPlanMode()).toBe(true);
    const res = await reg.execute('write', {}, { cwd: process.cwd() });
    expect(res.is_error).toBe(true);
    expect(res.output).toContain('plan mode');
    exitPlanMode();
    const ok = await reg.execute('write', {}, { cwd: process.cwd() });
    expect(ok.is_error).toBe(false);
  });
});
