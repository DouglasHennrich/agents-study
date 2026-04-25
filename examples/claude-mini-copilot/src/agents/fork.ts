// Sub-agent fork (s04) — runs runQuery with isolated messages, returns summary.
import { runQuery } from '../query.js';
import type { LlmProvider } from '../provider/types.js';
import type { ToolRegistry } from '../tools/registry.js';

export interface SubAgentInput {
  provider: LlmProvider;
  description: string;
  prompt: string;
  systemPrompt?: string;
  tools?: ToolRegistry;
  maxTurns?: number;
  model?: string;
}

export interface SubAgentResult {
  summary: string;
  turns: number;
  cost: number;
  is_error: boolean;
}

export async function runSubAgent(input: SubAgentInput): Promise<SubAgentResult> {
  let summary = '';
  let turns = 0;
  let cost = 0;
  let isError = false;

  for await (const evt of runQuery({
    provider: input.provider,
    prompt: input.prompt,
    systemPrompt: input.systemPrompt ?? `Sub-agent focado em: ${input.description}.`,
    tools: input.tools,
    maxTurns: input.maxTurns ?? 15,
    model: input.model,
  })) {
    if (evt.type === 'text') summary += evt.text;
    if (evt.type === 'tool_use') turns++;
    if (evt.type === 'tool_result' && evt.is_error) isError = true;
    if (evt.type === 'final') cost = evt.cost ?? 0;
  }

  return { summary: summary.trim(), turns, cost, is_error: isError };
}
