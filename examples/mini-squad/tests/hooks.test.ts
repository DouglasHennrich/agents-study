import { describe, it, expect } from 'vitest';
import { HookPipeline } from '../src/hooks/pipeline.js';
import {
  fileWriteGuard,
  piiScrubHook,
  rateLimitHook,
} from '../src/hooks/builtin.js';

const ctx = { sessionId: 's1', agentName: 'A' };

describe('HookPipeline + fileWriteGuard', () => {
  it('permite path dentro do allow', async () => {
    const p = new HookPipeline().register(
      fileWriteGuard({ allow: ['docs/**'], writeToolNames: ['fs_write'] }),
    );
    const d = await p.dispatch({
      kind: 'before_tool',
      ctx,
      call: { id: '1', name: 'fs_write', arguments: { path: 'docs/x.md' } },
    });
    expect(d.type).toBe('allow');
  });

  it('nega path fora do allow', async () => {
    const p = new HookPipeline().register(
      fileWriteGuard({ allow: ['docs/**'], writeToolNames: ['fs_write'] }),
    );
    const d = await p.dispatch({
      kind: 'before_tool',
      ctx,
      call: { id: '1', name: 'fs_write', arguments: { path: 'src/index.ts' } },
    });
    expect(d.type).toBe('deny');
  });
});

describe('piiScrubHook', () => {
  it('mascara CPF/email/telefone em mensagens before_llm', async () => {
    const p = new HookPipeline().register(piiScrubHook('before_llm'));
    const d = await p.dispatch({
      kind: 'before_llm',
      ctx,
      messages: [
        { role: 'user', content: 'meu cpf 123.456.789-00 e email a@b.com' },
      ],
    });
    expect(d.type).toBe('rewrite');
    if (d.type === 'rewrite' && d.payload.kind === 'before_llm') {
      expect(d.payload.messages[0].content).toBe('meu cpf [CPF] e email [EMAIL]');
    }
  });
});

describe('rateLimitHook', () => {
  it('bloqueia após exceder o limite', async () => {
    const p = new HookPipeline().register(
      rateLimitHook({ limit: 2, windowMs: 10_000 }),
    );
    const call = { id: '1', name: 'fs_write', arguments: {} };
    expect(
      (await p.dispatch({ kind: 'before_tool', ctx, call })).type,
    ).toBe('allow');
    expect(
      (await p.dispatch({ kind: 'before_tool', ctx, call })).type,
    ).toBe('allow');
    expect(
      (await p.dispatch({ kind: 'before_tool', ctx, call })).type,
    ).toBe('deny');
  });
});
