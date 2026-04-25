#!/usr/bin/env node
import { Command } from 'commander';
import { runQuery } from '../query.js';
import { defaultRegistry } from '../tools/builtin.js';
import { MockProvider } from '../provider/mock.js';
import type { LlmProvider } from '../provider/types.js';

const program = new Command();
program.name('claude-mini').description('Harness didático estilo Claude Code').version('0.1.0');

function getProvider(): LlmProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    // lazy import para não exigir SDK no caso mock
    const { AnthropicProvider } = require('../provider/anthropic.js') as typeof import('../provider/anthropic.js');
    return new AnthropicProvider();
  }
  console.error('[claude-mini] sem ANTHROPIC_API_KEY — usando MockProvider (responde "ok")');
  return new MockProvider([{ text: 'ok (mock provider — defina ANTHROPIC_API_KEY)' }]);
}

program
  .command('chat <prompt...>')
  .description('Roda uma conversa one-shot')
  .option('--max-turns <n>', 'limite de turnos', '10')
  .action(async (prompt: string[], opts) => {
    const provider = getProvider();
    const tools = defaultRegistry();
    let final = '';
    for await (const evt of runQuery({
      provider,
      prompt: prompt.join(' '),
      systemPrompt: 'Você é o claude-mini, um agent didático.',
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
