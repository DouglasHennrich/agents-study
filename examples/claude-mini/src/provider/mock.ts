// Mock provider — útil para testes e dev offline.
// Expõe um "script" pré-programado de respostas.
//
// Cada item de `script` é UMA chamada do modelo:
//   - text: resposta final em texto puro
//   - tool_uses: [{name, input}] dispara tool_use blocks
//
// Após esgotar o script, repete a última resposta (text vazio + end_turn).

import type { LlmProvider, StreamRequest, StreamEvent, ContentBlock } from './types.js';

export interface MockTurn {
  text?: string;
  tool_uses?: Array<{ name: string; input: unknown }>;
}

export class MockProvider implements LlmProvider {
  name = 'mock';
  private idx = 0;
  public calls: StreamRequest[] = [];

  constructor(private script: MockTurn[] = []) {}

  reset(script?: MockTurn[]) {
    if (script) this.script = script;
    this.idx = 0;
    this.calls = [];
  }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    this.calls.push(req);
    const turn = this.script[this.idx] ?? { text: '' };
    this.idx++;

    yield { type: 'message_start' };

    const blocks: ContentBlock[] = [];

    if (turn.text) {
      yield { type: 'content_block_start', block: { type: 'text' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: turn.text } };
      yield { type: 'content_block_stop' };
      blocks.push({ type: 'text', text: turn.text });
    }

    let toolCounter = 0;
    if (turn.tool_uses) {
      for (const t of turn.tool_uses) {
        const id = `tu_${this.idx}_${toolCounter++}`;
        yield { type: 'content_block_start', block: { type: 'tool_use', id, name: t.name } };
        yield {
          type: 'content_block_delta',
          delta: { type: 'input_json_delta', partial_json: JSON.stringify(t.input) },
        };
        yield { type: 'content_block_stop' };
        blocks.push({ type: 'tool_use', id, name: t.name, input: t.input });
      }
    }

    const stop_reason = turn.tool_uses && turn.tool_uses.length > 0 ? 'tool_use' : 'end_turn';
    yield {
      type: 'message_stop',
      stop_reason,
      usage: { input_tokens: 100, output_tokens: 50 },
      blocks,
    };
  }
}
