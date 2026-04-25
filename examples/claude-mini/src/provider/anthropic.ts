// Adapter para Anthropic API (opcional, requer ANTHROPIC_API_KEY).
// Versão mínima — só para mostrar plug. Se preferir Copilot SDK,
// implemente o mesmo `LlmProvider` interface em src/provider/copilot.ts.
//
// Para usar:
//   1. npm i @anthropic-ai/sdk
//   2. export ANTHROPIC_API_KEY=...
//   3. trocar MockProvider por AnthropicProvider no CLI.
//
// Como mantemos zero dependência hard, este arquivo usa fetch direto.

import type { LlmProvider, StreamRequest, StreamEvent, ContentBlock } from './types.js';

export class AnthropicProvider implements LlmProvider {
  name = 'anthropic';
  constructor(
    private apiKey = process.env.ANTHROPIC_API_KEY ?? '',
    private defaultModel = 'claude-sonnet-4-5-20250929',
  ) {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY não definido');
  }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    const body = {
      model: req.model ?? this.defaultModel,
      max_tokens: req.max_tokens ?? 4096,
      system: req.system,
      messages: req.messages,
      tools: req.tools.length > 0
        ? req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
        : undefined,
      stream: false,
    };
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    const blocks: ContentBlock[] = data.content ?? [];

    yield { type: 'message_start' };
    for (const b of blocks) {
      if (b.type === 'text') {
        yield { type: 'content_block_start', block: { type: 'text' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: b.text } };
        yield { type: 'content_block_stop' };
      } else if (b.type === 'tool_use') {
        yield { type: 'content_block_start', block: { type: 'tool_use', id: b.id, name: b.name } };
        yield { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } };
        yield { type: 'content_block_stop' };
      }
    }
    yield {
      type: 'message_stop',
      stop_reason: data.stop_reason ?? 'end_turn',
      usage: data.usage,
      blocks,
    };
  }
}
