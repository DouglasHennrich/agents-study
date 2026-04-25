# s00. Setup do projeto + escolha do provider LLM

> Bootstrap de `examples/claude-mini/` — base para os 12 capítulos seguintes.

## Estrutura-alvo

```
examples/claude-mini/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── src/
│   ├── cli.ts                 # entrypoint
│   ├── query.ts               # s01 — main loop
│   ├── provider/
│   │   ├── types.ts           # interface comum
│   │   ├── anthropic.ts       # provider Anthropic
│   │   └── copilot.ts         # provider Copilot (alternativa)
│   ├── tools/
│   │   ├── registry.ts        # s02
│   │   ├── builtin/           # bash, read, write, edit, glob, grep
│   │   ├── plan-mode.ts       # s03
│   │   └── todo.ts            # s03
│   ├── agents/
│   │   └── fork.ts            # s04
│   ├── skills/
│   │   └── loader.ts          # s05
│   ├── compact/
│   │   ├── auto.ts            # s06
│   │   ├── snip.ts            # s06
│   │   └── collapse.ts        # s06
│   ├── tasks/
│   │   ├── store.ts           # s07
│   │   └── background.ts      # s08
│   ├── teams/
│   │   ├── in-process.ts      # s09
│   │   ├── messaging.ts       # s10
│   │   └── coordinator.ts     # s11
│   ├── sandbox/
│   │   └── worktree.ts        # s12
│   └── persist/
│       └── jsonl.ts           # session log
└── tests/
```

## 1. `package.json`

```json
{
  "name": "@local/claude-mini",
  "version": "0.1.0",
  "type": "module",
  "bin": { "claude-mini": "./dist/cli.js" },
  "scripts": {
    "build": "tsc -p .",
    "dev": "tsx src/cli.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "commander": "^12.1.0",
    "zod": "^3.23.8",
    "picomatch": "^4.0.2",
    "ink": "^5.0.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

## 2. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false
  },
  "include": ["src/**/*"]
}
```

## 3. Provider LLM — interface comum

A primeira decisão arquitetural é **abstrair o provider**. Claude Code só fala com a Anthropic, mas vamos deixar plugável para você poder usar Copilot SDK (Trilha 1) ou local LLM se quiser.

📄 `src/provider/types.ts`

```ts
import { z } from 'zod';

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

export interface Message {
  role: Role;
  content: string | ContentBlock[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: object;        // JSON Schema
}

export interface StreamEvent {
  type: 'message_start' | 'content_block_delta' | 'content_block_stop'
      | 'message_delta' | 'message_stop' | 'tool_use_complete';
  delta?: { type: 'text_delta' | 'input_json_delta'; text?: string; partial_json?: string };
  block?: ContentBlock;
  stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage?: { input_tokens: number; output_tokens: number };
}

export interface LlmProvider {
  /** AsyncGenerator de eventos do streaming. */
  stream(input: {
    system: string;
    messages: Message[];
    tools: ToolDefinition[];
    model?: string;
    max_tokens?: number;
  }): AsyncGenerator<StreamEvent, void, unknown>;
}
```

## 4. Provider Anthropic

📄 `src/provider/anthropic.ts`

```ts
import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, StreamEvent } from './types.js';

export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY ausente');
    this.client = new Anthropic({ apiKey });
  }

  async *stream(input: Parameters<LlmProvider['stream']>[0]): AsyncGenerator<StreamEvent> {
    const stream = await this.client.messages.create({
      model: input.model ?? 'claude-sonnet-4-5-20250929',
      max_tokens: input.max_tokens ?? 4096,
      system: input.system,
      messages: input.messages.map(m => ({
        role: m.role === 'tool' ? 'user' : (m.role as 'user' | 'assistant'),
        content: m.content as any,
      })),
      tools: input.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as any,
      })),
      stream: true,
    });

    for await (const event of stream) {
      // mapeia eventos do SDK para nosso StreamEvent
      yield event as unknown as StreamEvent;
    }
  }
}
```

## 5. Provider Copilot (alternativa)

📄 `src/provider/copilot.ts`

Para quem não quer chave Anthropic. Reusa o wrapper da [Trilha 1 §02](../track-1-sdk/02-primeiro-agent/01-chamando-copilot-sdk.md):

```ts
import type { LlmProvider, StreamEvent } from './types.js';

export class CopilotProvider implements LlmProvider {
  async *stream(input: Parameters<LlmProvider['stream']>[0]): AsyncGenerator<StreamEvent> {
    const { default: sdk } = await import('@github/copilot-sdk').catch(() => ({ default: null }));
    if (!sdk) throw new Error('@github/copilot-sdk não disponível');

    // Adapter: Copilot SDK → eventos no formato Anthropic-like
    // (implementação simplificada — ver Trilha 1)
    yield { type: 'message_start' };
    // ... loop de chunks ...
    yield { type: 'message_stop', stop_reason: 'end_turn' };
  }
}
```

> Para o resto da trilha assumimos `AnthropicProvider`. O esquema de blocos `tool_use`/`tool_result` é nativo da Anthropic — adaptar pra Copilot exige um shim no provider.

## 6. CLI minimalista

📄 `src/cli.ts`

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { AnthropicProvider } from './provider/anthropic.js';
import { runQuery } from './query.js';

const program = new Command();
program.name('claude-mini').version('0.1.0');

program
  .command('chat')
  .argument('<prompt...>')
  .option('-m, --model <name>')
  .action(async (parts, opts) => {
    const provider = new AnthropicProvider();
    for await (const evt of runQuery({
      provider,
      prompt: parts.join(' '),
      model: opts.model,
    })) {
      if (evt.type === 'text') process.stdout.write(evt.text);
      if (evt.type === 'tool_use') console.error(`\n[tool: ${evt.name}]`);
      if (evt.type === 'final') console.error(`\n--- end (cost: $${evt.cost?.toFixed(4)}) ---`);
    }
  });

program.parse();
```

> `runQuery` ainda não existe — você implementa em [s01](s01-the-loop.md).

## 7. `.env.example`

```
ANTHROPIC_API_KEY=sk-ant-...
# ou para Copilot:
# GITHUB_TOKEN=ghp_...
```

## 8. Bootstrap

```bash
mkdir -p examples/claude-mini/src/{provider,tools/builtin,agents,skills,compact,tasks,teams,sandbox,persist} \
         examples/claude-mini/tests
cd examples/claude-mini
# cole os arquivos acima
npm install
npm run build
```

## ✓ Validar

```bash
node -e "import('@anthropic-ai/sdk').then(m => console.log('✓', Object.keys(m).slice(0,3)))"
# ou
node dist/cli.js --help
# Usage: claude-mini [options] [command]
```

## Próximo

→ [s01. The Loop — `while + stop_reason`](s01-the-loop.md)
