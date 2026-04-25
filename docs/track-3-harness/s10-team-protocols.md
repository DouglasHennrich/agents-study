# s10. Team Protocols — `SendMessage`

> *"Mailbox sem protocolo é confusão."* Defina request/response estruturado entre agents.

## Como Claude Code faz

📂 `src/tools/SendMessageTool/`

```ts
SendMessageTool({ to: string; message: string; await_reply: boolean; timeout_ms?: number })
```

- `await_reply=false` → fire-and-forget. Retorna imediatamente, mensagem na inbox do destinatário.
- `await_reply=true` → bloqueia até receber 1 resposta no outbox correspondente, ou timeout.
- Cada mensagem ganha `correlation_id` pra emparelhar request com reply.

## Versão didática

📄 `src/teams/protocol.ts`

```ts
import { randomBytes } from 'node:crypto';
import { deliver, getTeammate, tickTeammate } from './teammate.js';
import type { LlmProvider } from '../provider/types.js';

export interface Envelope {
  correlation_id: string;
  from: string;
  to: string;
  body: string;
  in_reply_to?: string;
  ts: string;
}

const pending = new Map<string, (env: Envelope) => void>();

export function newCorrelationId(): string { return `c_${randomBytes(4).toString('hex')}`; }

export async function sendMessage(input: {
  from: string; to: string; body: string;
  awaitReply: boolean; timeoutMs?: number;
  provider: LlmProvider;
}): Promise<Envelope | null> {
  const env: Envelope = {
    correlation_id: newCorrelationId(),
    from: input.from, to: input.to,
    body: input.body,
    ts: new Date().toISOString(),
  };
  deliver(input.to, { role: 'user', content: `[from ${input.from} cid=${env.correlation_id}] ${env.body}` });

  // dispara processamento async
  tickTeammate(input.to, input.provider).catch(() => {});

  if (!input.awaitReply) return null;

  return await waitReply(env.correlation_id, input.to, input.timeoutMs ?? 60_000);
}

async function waitReply(cid: string, fromTeammate: string, timeoutMs: number): Promise<Envelope> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tm = getTeammate(fromTeammate);
    if (tm && tm.outbox.length > 0) {
      const msg = tm.outbox.shift()!;
      return {
        correlation_id: cid, from: fromTeammate, to: '(caller)',
        body: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        in_reply_to: cid, ts: new Date().toISOString(),
      };
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`timeout aguardando reply de ${fromTeammate}`);
}
```

## Tool

📄 `src/tools/builtin/send-message.ts`

```ts
import { z } from 'zod';
import { buildTool } from '../registry.js';
import { sendMessage } from '../../teams/protocol.js';
import { AnthropicProvider } from '../../provider/anthropic.js';

export const sendMessageTool = buildTool({
  name: 'send_message',
  description: 'Envia mensagem a um teammate. await_reply=true bloqueia até resposta.',
  schema: z.object({
    to: z.string().describe('id do teammate'),
    message: z.string(),
    await_reply: z.boolean().default(false),
    timeout_ms: z.number().int().positive().optional(),
  }),
  async call({ to, message, await_reply, timeout_ms }) {
    const reply = await sendMessage({
      from: 'main', to, body: message,
      awaitReply: await_reply, timeoutMs: timeout_ms,
      provider: new AnthropicProvider(),
    });
    return reply ? { reply: reply.body, cid: reply.correlation_id } : { sent: true };
  },
});
```

## Padrões de comunicação

```
1. Request/Reply       send(to, msg, await=true)
2. Fire-and-forget     send(to, msg, await=false)
3. Broadcast           for tm in team_list: send(tm.id, msg, await=false)
4. Pipeline            send(A, "step1", await=true) → send(B, replyA, await=true)
```

## Anti-padrões

- ❌ Sempre `await_reply=true` (perde paralelismo).
- ❌ Mensagens sem `from` (destinatário não sabe a quem responder).
- ❌ Timeout infinito (deadlock se outro agent travou).
- ❌ Mailbox sem TTL (mensagens velhas confundem).

## ✓ Validar

```bash
npm run dev -- chat "Crie 2 teammates: 'planner' e 'critic'. Peça pro planner um plano. Mande o plano pro critic via send_message com await_reply. Mostre a crítica."
```

## Próximo

→ [s11. Autonomous Mode — coordinator loop](s11-autonomous-mode.md)
