import { describe, it, expect, beforeEach } from 'vitest';
import { runQuery } from '../src/query.js';
import { MockProvider } from '../src/provider/mock.js';
import { ToolRegistry, buildTool } from '../src/tools/registry.js';
import { resetPlanMode } from '../src/tools/plan-mode.js';
import { z } from 'zod';

beforeEach(() => resetPlanMode());

describe('runQuery (s01 — the loop, OpenAI format)', () => {
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

  it('executa tool_call → role:"tool" → resposta final', async () => {
    const echo = buildTool({
      name: 'echo',
      description: 'echo',
      schema: z.object({ msg: z.string() }),
      isReadOnly: true,
      async call({ msg }) { return msg.toUpperCase(); },
    });
    const tools = new ToolRegistry().register(echo);
    const provider = new MockProvider([
      { tool_calls: [{ name: 'echo', arguments: { msg: 'oi' } }] },
      { text: 'resultado: OI' },
    ]);
    const events: string[] = [];
    let finalMessages: any[] = [];
    for await (const evt of runQuery({ provider, prompt: 'ecoe oi', tools })) {
      events.push(evt.type);
      if (evt.type === 'final') finalMessages = evt.messages;
    }
    expect(events).toContain('tool_use');
    expect(events).toContain('tool_result');
    expect(events.at(-1)).toBe('final');

    // valida estrutura: assistant com tool_calls + msg role:"tool" com tool_call_id
    const assistantWithCalls = finalMessages.find((m) => m.role === 'assistant' && m.tool_calls?.length);
    expect(assistantWithCalls).toBeDefined();
    const toolReply = finalMessages.find((m) => m.role === 'tool');
    expect(toolReply).toBeDefined();
    expect(toolReply.tool_call_id).toBe(assistantWithCalls.tool_calls[0].id);
  });

  it('respeita maxTurns', async () => {
    const tool = buildTool({
      name: 'loop',
      description: 'loop',
      schema: z.object({}),
      async call() { return 'again'; },
    });
    const tools = new ToolRegistry().register(tool);
    const provider = new MockProvider(
      Array.from({ length: 10 }, () => ({ tool_calls: [{ name: 'loop', arguments: {} }] })),
    );
    let turns = 0;
    for await (const evt of runQuery({ provider, prompt: 'go', tools, maxTurns: 3 })) {
      if (evt.type === 'final') turns = evt.turns;
    }
    expect(turns).toBe(3);
  });

  it('coloca system como messages[0]', async () => {
    const provider = new MockProvider([{ text: 'oi' }]);
    for await (const _ of runQuery({ provider, prompt: 'a', systemPrompt: 'sou system' })) {
      // drain
    }
    expect(provider.calls[0].messages[0]).toMatchObject({ role: 'system', content: 'sou system' });
    expect(provider.calls[0].messages[1]).toMatchObject({ role: 'user', content: 'a' });
  });

  it('despacha múltiplas tool_calls paralelas em um único turno', async () => {
    const calls: string[] = [];
    const a = buildTool({
      name: 'a', description: 'a', schema: z.object({}),
      isReadOnly: true,
      async call() { calls.push('a'); return 'ra'; },
    });
    const b = buildTool({
      name: 'b', description: 'b', schema: z.object({}),
      isReadOnly: true,
      async call() { calls.push('b'); return 'rb'; },
    });
    const tools = new ToolRegistry().register(a).register(b);
    const provider = new MockProvider([
      { tool_calls: [{ name: 'a', arguments: {} }, { name: 'b', arguments: {} }] },
      { text: 'pronto' },
    ]);
    let finalMessages: any[] = [];
    for await (const evt of runQuery({ provider, prompt: 'go', tools })) {
      if (evt.type === 'final') finalMessages = evt.messages;
    }
    expect(calls).toEqual(['a', 'b']);
    // duas msgs role:"tool", uma por call, com tool_call_ids distintos
    const toolMsgs = finalMessages.filter((m) => m.role === 'tool');
    expect(toolMsgs.length).toBe(2);
    expect(new Set(toolMsgs.map((m) => m.tool_call_id)).size).toBe(2);
  });
});
