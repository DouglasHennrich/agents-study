// The Loop adaptado para protocolo OpenAI Chat Completions (Copilot SDK).
//
// Diferenças vs claude-mini (Anthropic):
//   - system entra como messages[0] (role:"system")
//   - tool_calls fica em assistantMsg.tool_calls (não em content[].type==='tool_use')
//   - tool result vai como N msgs role:"tool" com tool_call_id (uma por call)
//   - finish_reason: 'stop' | 'tool_calls' | 'length' | 'error'

import type { LlmProvider, Message } from './provider/types.js';
import { ToolRegistry, type ToolContext } from './tools/registry.js';

export interface RunQueryInput {
  provider: LlmProvider;
  systemPrompt?: string;
  prompt?: string;
  messages?: Message[];          // alternativa a prompt
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

  const messages: Message[] = [];
  if (input.systemPrompt) messages.push({ role: 'system', content: input.systemPrompt });
  if (input.messages) messages.push(...input.messages);
  if (input.prompt) messages.push({ role: 'user', content: input.prompt });

  let turn = 0;
  let totalIn = 0;
  let totalOut = 0;

  while (turn < maxTurns) {
    turn++;
    yield { type: 'turn_start', turn };

    let finishReason: 'stop' | 'tool_calls' | 'length' | 'error' = 'stop';
    let assistantMsg: Message = { role: 'assistant', content: null };

    for await (const evt of input.provider.stream({
      messages,
      tools: tools.toSpecs(),
      model: input.model,
    })) {
      if (evt.type === 'text_delta') yield { type: 'text', text: evt.text };
      if (evt.type === 'message_stop') {
        finishReason = evt.finish_reason;
        assistantMsg = evt.message;
        if (evt.usage) {
          totalIn += evt.usage.prompt_tokens;
          totalOut += evt.usage.completion_tokens;
        }
      }
    }

    messages.push(assistantMsg);

    if (finishReason !== 'tool_calls' || !assistantMsg.tool_calls?.length) break;

    // Para CADA tool_call, executar e adicionar 1 mensagem role:"tool"
    for (const call of assistantMsg.tool_calls) {
      yield { type: 'tool_use', id: call.id, name: call.name, input: call.arguments };
      const res = await tools.execute(call.name, call.arguments, ctx);
      yield { type: 'tool_result', id: call.id, output: res.output, is_error: res.is_error };
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: res.is_error ? `[error] ${res.output}` : res.output,
      });
    }
  }

  // gpt-4o-mini ~ $0.15/M input, $0.60/M output
  const cost = (totalIn * 0.15 + totalOut * 0.6) / 1_000_000;
  yield { type: 'final', messages, cost, turns: turn };
}
