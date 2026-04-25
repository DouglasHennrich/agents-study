import { describe, it, expect, beforeEach } from 'vitest';
import { runQuery } from '../src/query.js';
import { MockProvider } from '../src/provider/mock.js';
import { ToolRegistry, buildTool } from '../src/tools/registry.js';
import { resetPlanMode } from '../src/tools/plan-mode.js';
import { z } from 'zod';

beforeEach(() => resetPlanMode());

describe('runQuery (s01 — the loop)', () => {
  it('executa uma resposta de texto puro', async () => {
    const provider = new MockProvider([{ text: 'olá mundo' }]);
    let collected = '';
    let turns = 0;
    for await (const evt of runQuery({ provider, prompt: 'oi' })) {
      if (evt.type === 'text') collected += evt.text;
      if (evt.type === 'final') turns = evt.turns;
    }
    expect(collected).toBe('olá mundo');
    expect(turns).toBe(1);
  });

  it('executa tool_use → tool_result → resposta final', async () => {
    const echo = buildTool({
      name: 'echo',
      description: 'echo',
      schema: z.object({ msg: z.string() }),
      isReadOnly: true,
      async call({ msg }) { return msg.toUpperCase(); },
    });
    const tools = new ToolRegistry().register(echo);
    const provider = new MockProvider([
      { tool_uses: [{ name: 'echo', input: { msg: 'oi' } }] },
      { text: 'resultado: OI' },
    ]);
    const events: string[] = [];
    for await (const evt of runQuery({ provider, prompt: 'ecoe oi', tools })) {
      events.push(evt.type);
    }
    expect(events).toContain('tool_use');
    expect(events).toContain('tool_result');
    expect(events.at(-1)).toBe('final');
  });

  it('respeita maxTurns', async () => {
    const tool = buildTool({
      name: 'loop',
      description: 'loop',
      schema: z.object({}),
      async call() { return 'again'; },
    });
    const tools = new ToolRegistry().register(tool);
    // sempre chama tool, nunca termina
    const provider = new MockProvider(
      Array.from({ length: 10 }, () => ({ tool_uses: [{ name: 'loop', input: {} }] })),
    );
    let turns = 0;
    for await (const evt of runQuery({ provider, prompt: 'go', tools, maxTurns: 3 })) {
      if (evt.type === 'final') turns = evt.turns;
    }
    expect(turns).toBe(3);
  });
});
