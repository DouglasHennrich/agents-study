// In-process teammates (s09) + simple messaging (s10)
import type { LlmProvider, Message } from '../provider/types.js';
import type { ToolRegistry } from '../tools/registry.js';
import { runQuery } from '../query.js';
import { randomBytes } from 'node:crypto';

export interface Teammate {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  tools: ToolRegistry;
  inbox: Message[];
  outbox: Message[];
  history: Message[];
  busy: boolean;
}

const teammates = new Map<string, Teammate>();

export function createTeammate(input: {
  name: string; role: string; systemPrompt: string; tools: ToolRegistry;
}): Teammate {
  const id = `tm_${randomBytes(4).toString('hex')}`;
  const tm: Teammate = {
    id, name: input.name, role: input.role,
    systemPrompt: input.systemPrompt, tools: input.tools,
    inbox: [], outbox: [], history: [], busy: false,
  };
  teammates.set(id, tm);
  return tm;
}

export function getTeammate(id: string): Teammate | undefined { return teammates.get(id); }
export function listTeammates(): Teammate[] { return [...teammates.values()]; }
export function deleteTeammate(id: string): boolean { return teammates.delete(id); }
export function resetTeammates(): void { teammates.clear(); }

export function deliver(toId: string, msg: Message): void {
  const tm = teammates.get(toId);
  if (!tm) throw new Error(`teammate ${toId} não existe`);
  tm.inbox.push(msg);
}

export async function tickTeammate(id: string, provider: LlmProvider): Promise<void> {
  const tm = teammates.get(id);
  if (!tm || tm.busy || tm.inbox.length === 0) return;
  tm.busy = true;
  try {
    const newMsgs = tm.inbox.splice(0, tm.inbox.length);
    tm.history.push(...newMsgs);

    let response = '';
    for await (const evt of runQuery({
      provider,
      systemPrompt: tm.systemPrompt,
      messages: tm.history,
      tools: tm.tools,
      maxTurns: 5,
    })) {
      if (evt.type === 'text') response += evt.text;
    }
    const out: Message = { role: 'assistant', content: response };
    tm.history.push(out);
    tm.outbox.push(out);
  } finally {
    tm.busy = false;
  }
}

// Protocol (s10)
export interface Envelope {
  correlation_id: string;
  from: string;
  to: string;
  body: string;
  in_reply_to?: string;
  ts: string;
}

export async function sendMessage(input: {
  from: string; to: string; body: string; awaitReply: boolean;
  timeoutMs?: number; provider: LlmProvider;
}): Promise<Envelope | null> {
  const cid = `c_${randomBytes(4).toString('hex')}`;
  deliver(input.to, { role: 'user', content: `[from ${input.from} cid=${cid}] ${input.body}` });

  // dispara processamento
  tickTeammate(input.to, input.provider).catch(() => {});
  if (!input.awaitReply) return null;

  const deadline = Date.now() + (input.timeoutMs ?? 60_000);
  while (Date.now() < deadline) {
    const tm = getTeammate(input.to);
    if (tm && !tm.busy && tm.outbox.length > 0) {
      const msg = tm.outbox.shift()!;
      const body = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return {
        correlation_id: cid, from: input.to, to: input.from,
        body, in_reply_to: cid, ts: new Date().toISOString(),
      };
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`timeout aguardando reply de ${input.to}`);
}
