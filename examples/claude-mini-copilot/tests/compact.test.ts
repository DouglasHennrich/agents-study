import { describe, it, expect } from 'vitest';
import {
  SnipCompactStrategy, CollapseStrategy, AutoCompactStrategy, estimateTokens,
} from '../src/compact/strategies.js';
import { MockProvider } from '../src/provider/mock.js';
import type { Message } from '../src/provider/types.js';

describe('compact (s06 — OpenAI format)', () => {
  it('snip remove role:"tool" órfãos e assistant vazios', async () => {
    const msgs: Message[] = [
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: '' },                                   // vazio
      { role: 'tool', tool_call_id: 'inexistente', content: 'orphan' },     // órfão
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_x', name: 'echo', arguments: {} }],
      },
      { role: 'tool', tool_call_id: 'call_x', content: 'válido' },          // mantido
      ...Array.from({ length: 18 }, (_, i): Message => ({ role: 'user', content: `msg ${i}` })),
    ];
    const out = await new SnipCompactStrategy().apply(msgs);
    expect(out.length).toBeLessThan(msgs.length);
    expect(out.find((m) => m.role === 'tool' && m.tool_call_id === 'inexistente')).toBeUndefined();
    expect(out.find((m) => m.role === 'tool' && m.tool_call_id === 'call_x')).toBeDefined();
    expect(out.find((m) => m.role === 'assistant' && m.content === '')).toBeUndefined();
  });

  it('collapse junta msgs same-role consecutivas só de texto', async () => {
    const msgs: Message[] = [
      { role: 'user', content: 'parte1' },
      { role: 'user', content: 'parte2' },
      { role: 'assistant', content: 'resposta' },
    ];
    const out = await new CollapseStrategy().apply(msgs);
    expect(out.length).toBe(2);
    expect(out[0].content).toBe('parte1\nparte2');
  });

  it('auto resume metade antiga via provider preservando system', async () => {
    const provider = new MockProvider([{ text: 'resumo curto' }]);
    const msgs: Message[] = [
      { role: 'system', content: 'system inicial' },
      ...Array.from({ length: 20 }, (_, i): Message => ({
        role: i % 2 ? 'assistant' : 'user', content: `mensagem número ${i}`,
      })),
    ];
    const strat = new AutoCompactStrategy(provider, 10);
    expect(strat.shouldRun(msgs, estimateTokens(msgs))).toBe(true);
    const out = await strat.apply(msgs);
    expect(out.length).toBeLessThan(msgs.length);
    expect(out[0]).toMatchObject({ role: 'system' });
    expect(JSON.stringify(out)).toContain('resumo curto');
  });
});
