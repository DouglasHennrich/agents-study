// Wrapper sobre @github/copilot-sdk (formato OpenAI Chat Completions).
//
// Setup:
//   1. npm i @github/copilot-sdk    (ou variante usada pela sua org)
//   2. export COPILOT_TOKEN="$(gh auth token)"
//   3. usar CopilotProvider no lugar de MockProvider
//
// O SDK pode variar por versão. Adapte getClient() conforme necessário.
//
// Tipos `any` neste arquivo são intencionais: o SDK é carregado via
// `await import(pkg)` (string indireta) e não tem types em tempo de compilação
// no nosso package. Em produção, gere/instale os types do SDK e troque por tipos reais.

import type { LlmProvider, StreamRequest, StreamEvent, Message, ToolCall } from './types.js';

export interface CopilotProviderOpts {
  token?: string;
  model?: string;
}

type FinishReason = 'stop' | 'tool_calls' | 'length' | 'error';

export class CopilotProvider implements LlmProvider {
  name = 'copilot';
  private clientPromise?: Promise<any>;

  constructor(private opts: CopilotProviderOpts = {}) {}

  private async getClient(): Promise<any> {
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      // string indireta evita resolução estática do TS quando o pacote não está instalado
      const pkg = '@github/copilot-sdk';
      const mod: any = await import(/* @vite-ignore */ pkg).catch(() => null);
      if (!mod) {
        throw new Error('`@github/copilot-sdk` não instalado. npm i @github/copilot-sdk');
      }
      const Client = mod.CopilotClient ?? mod.default;
      return new Client({
        token: this.opts.token ?? process.env.COPILOT_TOKEN,
      });
    })();
    return this.clientPromise;
  }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    const client = await this.getClient();
    const res = await client.chat.completions.create({
      model: req.model ?? this.opts.model ?? process.env.COPILOT_MODEL ?? 'gpt-4o-mini',
      messages: req.messages.map(toOpenAi),
      tools: req.tools.length > 0
        ? req.tools.map((t) => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.parameters },
          }))
        : undefined,
      stream: false,
    });

    // Validação defensiva: respostas malformadas viram erro claro em vez de TypeError.
    if (!res?.choices?.[0]?.message) {
      throw new Error('CopilotProvider: resposta sem choices[0].message');
    }

    const choice = res.choices[0];
    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParse(tc.function.arguments),
    }));

    yield { type: 'message_start' };
    if (choice.message.content) {
      yield { type: 'text_delta', text: choice.message.content };
    }
    if (toolCalls) {
      for (const tc of toolCalls) {
        yield {
          type: 'tool_call_delta',
          id: tc.id,
          name: tc.name,
          argumentsPartial: JSON.stringify(tc.arguments),
        };
      }
    }
    yield {
      type: 'message_stop',
      finish_reason: normalizeFinishReason(choice.finish_reason),
      message: {
        role: 'assistant',
        content: choice.message.content ?? null,
        tool_calls: toolCalls,
      },
      usage: res.usage
        ? { prompt_tokens: res.usage.prompt_tokens, completion_tokens: res.usage.completion_tokens }
        : undefined,
    };
  }
}

/** Normaliza finish_reason para o conjunto suportado pelo loop. Valores
 * desconhecidos (ex.: 'content_filter', 'function_call' legacy) viram 'stop'
 * para que o loop encerre de forma graciosa. */
function normalizeFinishReason(raw: unknown): FinishReason {
  if (raw === 'tool_calls' || raw === 'length' || raw === 'error') return raw;
  return 'stop';
}

/** Converte uma Message interna para o formato OpenAI Chat Completions:
 *  - role/content/name/tool_call_id vão como estão.
 *  - tool_calls[].arguments é serializado como JSON string.
 *  - cada tool_call ganha o wrapping { type:'function', function:{...} }. */
function toOpenAi(m: Message): any {
  const out: any = { role: m.role };
  if (m.content !== undefined) out.content = m.content;
  if (m.tool_calls && m.tool_calls.length > 0) {
    out.tool_calls = m.tool_calls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
    }));
  }
  if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
  if (m.name) out.name = m.name;
  return out;
}

/** Parse seguro do JSON de `arguments` (alguns modelos enviam string vazia
 *  ou JSON levemente malformado). */
function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
