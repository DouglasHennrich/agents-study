// Mock provider OpenAI-style — para testes e dev offline.
import type { LlmProvider, StreamRequest, StreamEvent, ToolCall } from './types.js';

export interface MockTurn {
  text?: string;
  tool_calls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  finish_reason?: 'stop' | 'tool_calls' | 'length';
}

export class MockProvider implements LlmProvider {
  name = 'mock';
  public calls: StreamRequest[] = [];
  private idx = 0;

  constructor(private script: MockTurn[] = []) {}

  reset(s?: MockTurn[]) { if (s) this.script = s; this.idx = 0; this.calls = []; }

  async *stream(req: StreamRequest): AsyncIterable<StreamEvent> {
    this.calls.push(req);
    const turnIdx = this.idx;
    const turn = this.script[this.idx++] ?? { text: '' };

    yield { type: 'message_start' };

    const toolCalls: ToolCall[] | undefined = turn.tool_calls?.map((tc, i) => ({
      id: `call_${turnIdx}_${i}`,
      name: tc.name,
      arguments: tc.arguments,
    }));

    if (turn.text) yield { type: 'text_delta', text: turn.text };

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

    const finish = turn.finish_reason ?? (toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop');
    yield {
      type: 'message_stop',
      finish_reason: finish,
      message: {
        role: 'assistant',
        content: turn.text ?? null,
        tool_calls: toolCalls,
      },
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };
  }
}
