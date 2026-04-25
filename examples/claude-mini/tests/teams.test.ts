import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTeammate, sendMessage, listTeammates, resetTeammates, getTeammate,
} from '../src/teams/teammate.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { MockProvider } from '../src/provider/mock.js';

beforeEach(() => resetTeammates());

describe('teammates (s09 + s10)', () => {
  it('cria teammate e troca mensagens com resposta', async () => {
    const provider = new MockProvider([{ text: 'pong' }]);
    const tm = createTeammate({
      name: 'reviewer',
      role: 'qa',
      systemPrompt: 'você responde curto',
      tools: new ToolRegistry(),
    });
    const reply = await sendMessage({
      from: 'main', to: tm.id, body: 'ping',
      awaitReply: true, timeoutMs: 3000, provider,
    });
    expect(reply?.body).toBe('pong');
    expect(listTeammates()).toHaveLength(1);
    expect(getTeammate(tm.id)?.history.length).toBeGreaterThan(0);
  });

  it('fire-and-forget retorna null', async () => {
    const provider = new MockProvider([{ text: 'ok' }]);
    const tm = createTeammate({
      name: 'worker', role: 'worker', systemPrompt: '', tools: new ToolRegistry(),
    });
    const r = await sendMessage({
      from: 'main', to: tm.id, body: 'hi',
      awaitReply: false, provider,
    });
    expect(r).toBeNull();
  });
});
