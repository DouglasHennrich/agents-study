#!/usr/bin/env node
import { Command } from 'commander';
import { runQuery } from '../query.js';
import { defaultRegistry } from '../tools/builtin.js';
import { MockProvider } from '../provider/mock.js';
import type { LlmProvider } from '../provider/types.js';

const program = new Command();
program.name('claude-mini-copilot').description('Harness estilo Claude Code com Copilot como LLM').version('0.1.0');

async function getProvider(): Promise<LlmProvider> {
  if (process.env.COPILOT_TOKEN) {
    const mod = await import('../provider/copilot.js');
    return new mod.CopilotProvider({ model: process.env.COPILOT_MODEL });
  }
  console.error('[claude-mini-copilot] sem COPILOT_TOKEN — usando MockProvider');
  return new MockProvider([{ text: 'ok (mock provider — defina COPILOT_TOKEN)' }]);
}

program
  .command('chat <prompt...>')
  .description('Roda uma conversa one-shot')
  .option('--max-turns <n>', 'limite de turnos', '10')
  .action(async (prompt: string[], opts) => {
    const provider = await getProvider();
    const tools = defaultRegistry();
    let final = '';
    for await (const evt of runQuery({
      provider,
      prompt: prompt.join(' '),
      systemPrompt: 'Você é o claude-mini-copilot, um agent didático.',
      tools,
      maxTurns: Number(opts.maxTurns),
    })) {
      if (evt.type === 'text') { process.stdout.write(evt.text); final += evt.text; }
      if (evt.type === 'tool_use') console.error(`\n[tool] ${evt.name}(${JSON.stringify(evt.input)})`);
      if (evt.type === 'tool_result') console.error(`[result] ${evt.output.slice(0, 200)}`);
      if (evt.type === 'final') console.error(`\n[done] ${evt.turns} turnos, $${evt.cost?.toFixed(4) ?? '0'}`);
    }
    if (!final) process.stdout.write('\n');
  });

program.parseAsync().catch((e) => { console.error(e); process.exit(1); });
