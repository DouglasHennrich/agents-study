// Wrapper sobre @github/copilot-sdk v0.3+ (arquitetura baseada em sessões JSON-RPC).
//
// Setup:
//   1. npm i @github/copilot-sdk
//   2. export COPILOT_TOKEN="$(gh auth token)"
//   3. usar CopilotProvider no lugar de MockProvider
//
// Nota sobre tool calls: o SDK v0.3+ executa o loop ReAct internamente.
// Tools devem ser registradas com handlers ao criar a sessão. Nesta implementação,
// o provider não registra tools — o `message_stop` sempre terá `finish_reason: 'stop'`
// com o texto final da resposta (após o SDK ter resolvido eventuais tool calls).

import { CopilotClient, approveAll } from '@github/copilot-sdk';
import type { LlmProvider, StreamRequest, StreamEvent, Message } from './types.js';

export interface CopilotProviderOpts {
  token?: string;
  model?: string;
}

export class CopilotProvider implements LlmProvider {
  name = 'copilot';
  private client: CopilotClient;

  constructor(private opts: CopilotProviderOpts = {}) {
    this.client = new CopilotClient({
      gitHubToken: this.opts.token ?? process.env.COPILOT_TOKEN,
    });
  }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    const systemContent = req.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .filter(Boolean)
      .join('\n');

    const nonSystemMessages = req.messages.filter(m => m.role !== 'system');

    const session = await this.client.createSession({
      model: req.model ?? this.opts.model ?? process.env.COPILOT_MODEL ?? 'gpt-4o-mini',
      streaming: true,
      onPermissionRequest: approveAll,
      ...(systemContent ? {
        systemMessage: { mode: 'replace' as const, content: systemContent },
      } : {}),
    });

    try {
      // Replay turns anteriores
      for (const msg of nonSystemMessages.slice(0, -1)) {
        if (msg.role === 'user') {
          await session.sendAndWait({ prompt: msg.content ?? '' });
        }
      }

      const lastMsg = nonSystemMessages.at(-1);

      // Bridge callbacks → AsyncIterable (resolvers-first para garantir yield por chunk)
      type Item = StreamEvent | 'done';
      const pending: Item[] = [];
      let waiting: ((item: Item) => void) | null = null;

      const push = (item: Item) => {
        if (waiting) { waiting(item); waiting = null; }
        else { pending.push(item); }
      };
      const pull = (): Promise<Item> => {
        if (pending.length > 0) return Promise.resolve(pending.shift()!);
        return new Promise<Item>(resolve => { waiting = resolve; });
      };

      let fullContent = '';

      const unsubDelta = session.on('assistant.message_delta', (event) => {
        const text = (event.data as any).deltaContent ?? '';
        fullContent += text;
        push({ type: 'text_delta', text });
      });

      const unsubIdle = session.on('session.idle', () => {
        unsubDelta(); unsubIdle();
        push('done');
      });

      yield { type: 'message_start' };

      await session.send({ prompt: lastMsg?.content ?? '' });

      while (true) {
        const item = await pull();
        if (item === 'done') break;
        yield item as StreamEvent;
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: fullContent || null,
      };

      yield {
        type: 'message_stop',
        finish_reason: 'stop',
        message: assistantMsg,
        usage: undefined,
      };
    } finally {
      await session.disconnect();
    }
  }
}
