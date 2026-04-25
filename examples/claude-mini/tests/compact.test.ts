import { describe, it, expect } from 'vitest';
import {
  SnipCompactStrategy, CollapseStrategy, AutoCompactStrategy, estimateTokens,
} from '../src/compact/strategies.js';
import { MockProvider } from '../src/provider/mock.js';
import type { Message } from '../src/provider/types.js';

describe('compact (s06)', () => {
  it('snip remove mensagens vazias e tool_results órfãos', async () => {
    const msgs: Message[] = [
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: '' },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: '', content: 'orphan' } as any] },
      { role: 'assistant', content: 'ok' },
      ...Array.from({ length: 18 }, (_, i): Message => ({ role: 'user', content: `msg ${i}` })),
    ];
    const out = await new SnipCompactStrategy().apply(msgs);
    expect(out.length).toBeLessThan(msgs.length);
    expect(out.every((m) => typeof m.content !== 'string' || m.content.length > 0)).toBe(true);
  });

  it('collapse junta text blocks consecutivos', async () => {
    const msgs: Message[] = [{
      role: 'assistant',
      content: [
        { type: 'text', text: 'parte1' },
        { type: 'text', text: 'parte2' },
        { type: 'tool_use', id: 't1', name: 'x', input: {} },
        { type: 'text', text: 'parte3' },
      ],
    }];
    const out = await new CollapseStrategy().apply(msgs);
    const blocks = out[0].content as any[];
    expect(blocks.length).toBe(3);
    expect(blocks[0].text).toBe('parte1\nparte2');
  });

  it('auto resume metade antiga via provider', async () => {
    const provider = new MockProvider([{ text: 'resumo curto' }]);
    const msgs: Message[] = Array.from({ length: 20 }, (_, i): Message => ({
      role: i % 2 ? 'assistant' : 'user', content: `mensagem número ${i}`,
    }));
    const strat = new AutoCompactStrategy(provider, 10);
    expect(strat.shouldRun(msgs, estimateTokens(msgs))).toBe(true);
    const out = await strat.apply(msgs);
    expect(out.length).toBeLessThan(msgs.length);
    expect(JSON.stringify(out[0].content)).toContain('resumo curto');
  });
});
