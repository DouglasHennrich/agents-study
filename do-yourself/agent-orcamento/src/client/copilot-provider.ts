import { CopilotClient, approveAll } from '@github/copilot-sdk';

import type { IChatRequest, IChatResponse, IStreamChunk } from './types.js';


/**
 * Interface que abstrai o provedor LLM. A implementação real usa o
 * @github/copilot-sdk; em testes usamos um stub determinístico.
 */
export interface ILlmProvider {
  chat(req: IChatRequest): Promise<IChatResponse>;
  stream?(req: IChatRequest): AsyncIterable<IStreamChunk>;
}

/**
 * Wrapper fino sobre o GitHub Copilot SDK v0.3+.
 *
 * O SDK usa uma arquitetura baseada em sessões JSON-RPC — diferente da API
 * OpenAI Chat Completions. Cada chamada a `chat()` cria uma sessão, envia
 * as mensagens e aguarda o evento `assistant.message` via `sendAndWait()`.
 */
export class CopilotProvider implements ILlmProvider {
  private client: CopilotClient;

  constructor(private readonly opts: { model?: string } = {}) {
    if (!process.env.COPILOT_TOKEN) {
      throw new Error('GitHub Copilot token is required. Set it via the COPILOT_TOKEN environment variable.');
    }

    this.client = new CopilotClient({
      gitHubToken: process.env.COPILOT_TOKEN,
    });
  }

  async chat(req: IChatRequest): Promise<IChatResponse> {
    const systemContent = req.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .filter(Boolean)
      .join('\n');

    const nonSystemMessages = req.messages.filter(m => m.role !== 'system');

    const session = await this.client.createSession({
      model: req.model ?? this.opts.model ?? 'gpt-4.1',
      onPermissionRequest: approveAll,
      ...(systemContent ? {
        systemMessage: { mode: 'replace' as const, content: systemContent },
      } : {}),
    });

    try {
      // Replay turns anteriores para manter contexto em conversas multi-turn
      for (const msg of nonSystemMessages.slice(0, -1)) {
        if (msg.role === 'user') {
          await session.sendAndWait({ prompt: msg.content ?? '' });
        }
      }

      const lastMsg = nonSystemMessages.at(-1);
      const event = await session.sendAndWait({ prompt: lastMsg?.content ?? '' });

      return {
        message: {
          role: 'assistant',
          content: event?.data.content ?? null,
        },
        finishReason: 'stop',
      };
    } finally {
      await session.disconnect();
    }
  }

  async *stream(req: IChatRequest): AsyncIterable<IStreamChunk> {
    const systemContent = req.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .filter(Boolean)
      .join('\n');

    const nonSystemMessages = req.messages.filter(m => m.role !== 'system');

    const session = await this.client.createSession({
      model: req.model ?? this.opts.model ?? 'gpt-4.1',
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

      // Fila "resolvers-first": quando há um consumer aguardando, o item é
      // entregue diretamente a ele (sem buffer). Isso garante que o generator
      // sempre faz um `await pull()` real antes de cada yield — evitando que
      // a fila seja drenada em rajada sem pausas entre os chunks.
      type Item = IStreamChunk | 'done';
      const pending: Item[] = [];
      let waiting: ((item: Item) => void) | null = null;

      const push = (item: Item) => {
        if (waiting) {
          waiting(item);
          waiting = null;
        } else {
          pending.push(item);
        }
      };

      const pull = (): Promise<Item> => {
        if (pending.length > 0) {
          return Promise.resolve(pending.shift()!);
        }
        return new Promise<Item>(resolve => { waiting = resolve; });
      };

      const unsubDelta = session.on('assistant.message_delta', (event) => {
        push({ delta: (event.data as any).deltaContent ?? '' });
      });

      const unsubIdle = session.on('session.idle', () => {
        unsubDelta();
        unsubIdle();
        push('done');
      });

      await session.send({ prompt: lastMsg?.content ?? '' });

      while (true) {
        const item = await pull();
        if (item === 'done') break;
        yield item as IStreamChunk;
      }

      yield { delta: '', finishReason: 'stop' };
    } finally {
      await session.disconnect();
    }
  }
}
