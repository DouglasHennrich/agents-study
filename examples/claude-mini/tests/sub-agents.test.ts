import { describe, it, expect } from 'vitest';
import { runSubAgent } from '../src/agents/fork.js';
import { MockProvider } from '../src/provider/mock.js';

describe('sub-agents (s04)', () => {
  it('isola contexto e devolve summary', async () => {
    const provider = new MockProvider([{ text: 'descobri o bug em foo.ts:42' }]);
    const result = await runSubAgent({
      provider,
      description: 'caçar bug',
      prompt: 'cace o bug',
    });
    expect(result.summary).toContain('foo.ts:42');
    expect(result.is_error).toBe(false);
  });
});
