# s02. Tool Dispatch — `buildTool` factory

> *"Adicionar uma tool = adicionar um handler"*. O loop não muda. Só o registry cresce.

## Como Claude Code faz

📂 `src/Tool.ts` + `src/tools.ts` + `src/tools/<Nome>Tool/`

Cada tool implementa o mesmo contrato (resumo do skill `agent-harness-construction` + reverso do código real):

```
LIFECYCLE          validateInput / checkPermissions / call
CAPABILITIES       isEnabled / isConcurrencySafe / isReadOnly / isDestructive
RENDERING          renderToolUseMessage / renderToolResultMessage / progress
AI-FACING          prompt / description / mapToolResultToAPI
```

`buildTool(definition)` é a **factory** que:

1. Aplica defaults sensatos (`isReadOnly: false`, `isConcurrencySafe: false` etc.).
2. Embrulha `validateInput` num try/catch que retorna `{is_error: true, ...}` em vez de throw.
3. Compila o Zod schema → JSON Schema pra mandar pra API.
4. Registra a tool no dispatcher global.

## Versão didática (claude-mini)

📄 `src/tools/registry.ts`

```ts
import { z, ZodSchema } from 'zod';
import type { ToolDefinition } from '../provider/types.js';

export interface ToolContext {
  cwd: string;
  signal?: AbortSignal;
}

export interface Tool<I = unknown, O = unknown> {
  name: string;
  description: string;
  schema: ZodSchema<I>;
  isReadOnly: boolean;
  isConcurrencySafe: boolean;
  isDestructive: boolean;
  call(input: I, ctx: ToolContext): Promise<O>;
  checkPermissions?(input: I, ctx: ToolContext): Promise<{ ok: true } | { ok: false; reason: string }>;
}

export interface ToolResult {
  output: unknown;
  is_error: boolean;
}

export interface BuildToolDef<I, O> {
  name: string;
  description: string;
  schema: ZodSchema<I>;
  call(input: I, ctx: ToolContext): Promise<O>;
  isReadOnly?: boolean;
  isConcurrencySafe?: boolean;
  isDestructive?: boolean;
  checkPermissions?: Tool<I, O>['checkPermissions'];
}

export function buildTool<I, O>(def: BuildToolDef<I, O>): Tool<I, O> {
  return {
    name: def.name,
    description: def.description,
    schema: def.schema,
    isReadOnly: def.isReadOnly ?? false,
    isConcurrencySafe: def.isConcurrencySafe ?? false,
    isDestructive: def.isDestructive ?? false,
    call: def.call,
    checkPermissions: def.checkPermissions,
  };
}

export class ToolRegistry {
  private tools = new Map<string, Tool<any, any>>();
  private cwd = process.cwd();

  register(tool: Tool<any, any>): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  toApiSpec(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      input_schema: zodToJsonSchema(t.schema),
    }));
  }

  async execute(name: string, rawInput: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { output: `unknown tool: ${name}`, is_error: true };

    const parsed = tool.schema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        output: `invalid input: ${parsed.error.message}`,
        is_error: true,
      };
    }

    const ctx: ToolContext = { cwd: this.cwd };

    if (tool.checkPermissions) {
      const perm = await tool.checkPermissions(parsed.data, ctx);
      if (!perm.ok) return { output: `permission denied: ${perm.reason}`, is_error: true };
    }

    try {
      const out = await tool.call(parsed.data, ctx);
      return { output: out, is_error: false };
    } catch (err) {
      return { output: `tool failed: ${(err as Error).message}`, is_error: true };
    }
  }
}

// JSON Schema mínimo a partir de Zod (versão didática)
function zodToJsonSchema(schema: ZodSchema): object {
  const def = (schema as any)._def;
  if (def.typeName === 'ZodObject') {
    const shape = def.shape();
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries<any>(shape)) {
      properties[k] = zodToJsonSchema(v);
      if (!v.isOptional?.()) required.push(k);
    }
    return { type: 'object', properties, required };
  }
  if (def.typeName === 'ZodString') return { type: 'string' };
  if (def.typeName === 'ZodNumber') return { type: 'number' };
  if (def.typeName === 'ZodBoolean') return { type: 'boolean' };
  if (def.typeName === 'ZodArray') return { type: 'array', items: zodToJsonSchema(def.type) };
  if (def.typeName === 'ZodOptional') return zodToJsonSchema(def.innerType);
  return {};
}
```

## Tools built-in mínimas

📄 `src/tools/builtin/bash.ts`

```ts
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { buildTool } from '../registry.js';

export const bashTool = buildTool({
  name: 'bash',
  description: 'Executa um comando no shell. Use para inspecionar files, rodar scripts, git ops.',
  schema: z.object({
    command: z.string().describe('Comando a executar'),
    timeout_ms: z.number().optional().default(30_000),
  }),
  isDestructive: true,
  isConcurrencySafe: false,
  async call({ command, timeout_ms }) {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-lc', command], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', d => stdout += d);
      child.stderr.on('data', d => stderr += d);
      const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('timeout')); }, timeout_ms);
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ stdout: stdout.slice(0, 30_000), stderr: stderr.slice(0, 5000), exit: code });
      });
    });
  },
});
```

📄 `src/tools/builtin/file-read.ts`

```ts
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { buildTool } from '../registry.js';

export const fileReadTool = buildTool({
  name: 'read_file',
  description: 'Lê um arquivo de texto. Para arquivos > 100KB, mostra apenas as primeiras 30000 chars.',
  schema: z.object({ path: z.string() }),
  isReadOnly: true,
  isConcurrencySafe: true,
  async call({ path }) {
    const content = await readFile(path, 'utf-8');
    return content.length > 30_000
      ? { path, truncated: true, content: content.slice(0, 30_000) }
      : { path, truncated: false, content };
  },
});
```

📄 `src/tools/builtin/file-write.ts`

```ts
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { buildTool } from '../registry.js';

export const fileWriteTool = buildTool({
  name: 'write_file',
  description: 'Cria ou sobrescreve um arquivo com o conteúdo dado.',
  schema: z.object({ path: z.string(), content: z.string() }),
  isDestructive: true,
  async call({ path, content }) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf-8');
    return { path, bytes: content.length };
  },
});
```

## Por que esse padrão?

| Decisão | Razão |
|---|---|
| Factory `buildTool` em vez de classe | menos boilerplate; defaults aplicados num ponto só |
| Zod como source of truth | um schema gera validação + JSON Schema + tipos TS |
| `is_error` na resposta em vez de throw | o **modelo** decide se retenta com input corrigido |
| `isConcurrencySafe` declarativo | StreamingToolExecutor (s06) usa para paralelizar |
| `checkPermissions` separado de `call` | regras de segurança não misturam com lógica |

## Anti-padrões

- ❌ Tool que muta `messages[]` ou estado global.
- ❌ `description` que assume contexto que o modelo não tem.
- ❌ Output binário cru (sem base64 / metadata).
- ❌ `call` síncrono que bloqueia o event loop.
- ❌ Schema vazio (`z.any()`) — modelo manda lixo.

## Conectando ao loop

📄 `src/cli.ts` (atualização)

```ts
import { ToolRegistry } from './tools/registry.js';
import { bashTool } from './tools/builtin/bash.js';
import { fileReadTool } from './tools/builtin/file-read.js';
import { fileWriteTool } from './tools/builtin/file-write.js';

const tools = new ToolRegistry()
  .register(bashTool)
  .register(fileReadTool)
  .register(fileWriteTool);

// passa para runQuery:
runQuery({ provider, prompt, tools });
```

## ✓ Validar

```bash
npm run dev -- chat "Liste os arquivos da pasta atual usando bash, depois leia o package.json"
```

Você vê:

```
[tool: bash]
[tool: read_file]
{ ... resumo ... }
```

## Próximo

→ [s03. Planning — Plan Mode + Todo](s03-planning.md)
