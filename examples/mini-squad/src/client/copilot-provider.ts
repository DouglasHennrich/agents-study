import type { ChatRequest, ChatResponse, StreamChunk } from './types.js';

/**
 * Interface que abstrai o provedor LLM. A implementação real usa o
 * @github/copilot-sdk; em testes usamos um stub determinístico.
 */
export interface LlmProvider {
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream?(req: ChatRequest): AsyncIterable<StreamChunk>;
}

/**
 * Wrapper fino sobre o GitHub Copilot SDK.
 *
 * O SDK exato pode variar por versão/organização. Mantemos a integração
 * isolada aqui para que possamos trocá-la sem tocar no resto do código.
 */
export class CopilotProvider implements LlmProvider {
  private clientPromise?: Promise<unknown>;

  constructor(private readonly opts: { token?: string; model?: string } = {}) {}

  private async getClient(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        // Import dinâmico para que o módulo seja opcional em ambiente de teste.
        const mod: any = await import('@github/copilot-sdk').catch(() => null);
        if (!mod) {
          throw new Error(
            '`@github/copilot-sdk` não está instalado. Veja docs/01-setup/.',
          );
        }
        const Client = mod.CopilotClient ?? mod.default;
        return new Client({
          token: this.opts.token ?? process.env.COPILOT_TOKEN,
        });
      })();
    }
    return this.clientPromise;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const client = await this.getClient();
    const res = await client.chat.completions.create({
      model: req.model ?? this.opts.model ?? 'gpt-4o-mini',
      messages: req.messages,
      tools: req.tools?.map((t) => ({ type: 'function', function: t })),
      stream: false,
    });
    const choice = res.choices[0];
    return {
      message: {
        role: 'assistant',
        content: choice.message.content,
        tool_calls: choice.message.tool_calls?.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || '{}'),
        })),
      },
      finishReason: choice.finish_reason,
    };
  }

  async *stream(req: ChatRequest): AsyncIterable<StreamChunk> {
    const client = await this.getClient();
    const res = await client.chat.completions.create({
      model: req.model ?? this.opts.model ?? 'gpt-4o-mini',
      messages: req.messages,
      tools: req.tools?.map((t) => ({ type: 'function', function: t })),
      stream: true,
    });
    for await (const chunk of res) {
      const delta = chunk.choices[0]?.delta;
      yield {
        delta: delta?.content ?? '',
        toolCallDelta: delta?.tool_calls?.[0]
          ? {
              id: delta.tool_calls[0].id,
              name: delta.tool_calls[0].function?.name,
            }
          : undefined,
        finishReason: chunk.choices[0]?.finish_reason ?? undefined,
      };
    }
  }
}
