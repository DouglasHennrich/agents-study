// The Loop (s01) — agnostic to provider, drives turns until end_turn.

import type { LlmProvider, Message, ContentBlock } from './provider/types.js';
import { ToolRegistry, type ToolContext } from './tools/registry.js';

export interface RunQueryInput {
  provider: LlmProvider;
  systemPrompt?: string;
  prompt?: string;
  messages?: Message[];          // alternativa a prompt: já vem com histórico
  tools?: ToolRegistry;
  model?: string;
  maxTurns?: number;
  cwd?: string;
  signal?: AbortSignal;
}

export type QueryEvent =
  | { type: 'turn_start'; turn: number }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; output: string; is_error: boolean }
  | { type: 'final'; messages: Message[]; cost?: number; turns: number };

export async function* runQuery(input: RunQueryInput): AsyncGenerator<QueryEvent> {
  const tools = input.tools ?? new ToolRegistry();
  const ctx: ToolContext = { cwd: input.cwd ?? process.cwd(), signal: input.signal };
  const maxTurns = input.maxTurns ?? 25;

  const messages: Message[] = input.messages ? [...input.messages] : [];
  if (input.prompt) messages.push({ role: 'user', content: input.prompt });

  let turn = 0;
  let totalInput = 0;
  let totalOutput = 0;

  while (turn < maxTurns) {
    turn++;
    yield { type: 'turn_start', turn };

    let stopReason: 'end_turn' | 'tool_use' | 'max_tokens' = 'end_turn';
    let finalBlocks: ContentBlock[] = [];

    for await (const evt of input.provider.stream({
      system: input.systemPrompt ?? '',
      messages,
      tools: tools.toSpecs(),
      model: input.model,
    })) {
      if (evt.type === 'content_block_delta' && evt.delta.type === 'text_delta' && evt.delta.text) {
        yield { type: 'text', text: evt.delta.text };
      }
      if (evt.type === 'message_stop') {
        stopReason = evt.stop_reason;
        finalBlocks = evt.blocks;
        if (evt.usage) {
          totalInput += evt.usage.input_tokens;
          totalOutput += evt.usage.output_tokens;
        }
      }
    }

    messages.push({ role: 'assistant', content: finalBlocks });

    if (stopReason === 'end_turn' || stopReason === 'max_tokens') break;

    // tool_use → executar todas, devolver tool_results em UMA mensagem user
    const toolResults: ContentBlock[] = [];
    for (const block of finalBlocks) {
      if (block.type !== 'tool_use') continue;
      yield { type: 'tool_use', id: block.id, name: block.name, input: block.input };
      const res = await tools.execute(block.name, block.input, ctx);
      yield { type: 'tool_result', id: block.id, output: res.output, is_error: res.is_error };
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: res.output,
        is_error: res.is_error,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  // custo aproximado (Sonnet 4.5: $3/M input, $15/M output)
  const cost = (totalInput * 3 + totalOutput * 15) / 1_000_000;
  yield { type: 'final', messages, cost, turns: turn };
}
