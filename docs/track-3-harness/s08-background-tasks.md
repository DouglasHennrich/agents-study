# s08. Background Tasks — daemons + notificações

> *"Operações lentas em background; o agent continua pensando."* Em vez de bloquear o loop esperando `npm test`, dispare em segundo plano e injete o resultado quando chegar.

## Como Claude Code faz

📂 `src/tasks/DreamTask/`, `src/tasks/LocalShellTask/`

- **`LocalShellTask`** — bash em background com PID + log file. Tool retorna o ID imediatamente.
- **`DreamTask`** — "pensamento em background" (chamada LLM secundária pra refletir/planejar). Resultado vira notificação.
- Notificação chega como **`tool_result` adicional** no próximo turno do agent — ele decide o que fazer.

## Versão didática

📄 `src/tasks/background.ts`

```ts
import { spawn, ChildProcess } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

interface BgTask {
  id: string;
  command: string;
  status: 'running' | 'done' | 'failed';
  pid: number;
  logFile: string;
  exit_code?: number;
  started_at: string;
  finished_at?: string;
}

const tasks = new Map<string, BgTask>();
const procs = new Map<string, ChildProcess>();
const dir = `${process.env.HOME}/.claude-mini/bg`;

export async function spawnBg(command: string): Promise<BgTask> {
  await mkdir(dir, { recursive: true });
  const id = `b_${randomBytes(4).toString('hex')}`;
  const logFile = join(dir, `${id}.log`);
  await writeFile(logFile, '');

  const child = spawn('bash', ['-lc', command], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', d => appendLog(logFile, d));
  child.stderr.on('data', d => appendLog(logFile, d));
  child.on('close', code => {
    const t = tasks.get(id);
    if (!t) return;
    t.status = code === 0 ? 'done' : 'failed';
    t.exit_code = code ?? -1;
    t.finished_at = new Date().toISOString();
  });

  const task: BgTask = {
    id, command, status: 'running', pid: child.pid!, logFile,
    started_at: new Date().toISOString(),
  };
  tasks.set(id, task);
  procs.set(id, child);
  return task;
}

export function getBg(id: string): BgTask | undefined { return tasks.get(id); }
export function listBg(): BgTask[] { return Array.from(tasks.values()); }
export async function readBgLog(id: string): Promise<string> {
  const t = tasks.get(id);
  if (!t) throw new Error(`bg ${id} not found`);
  return await readFile(t.logFile, 'utf-8');
}
export function killBg(id: string) { procs.get(id)?.kill('SIGTERM'); }

import { appendFile } from 'node:fs/promises';
function appendLog(path: string, data: Buffer) {
  appendFile(path, data).catch(() => {});
}
```

## Tools

📄 `src/tools/builtin/background.ts`

```ts
import { z } from 'zod';
import { buildTool } from '../registry.js';
import { spawnBg, getBg, listBg, readBgLog, killBg } from '../../tasks/background.js';

export const bgRunTool = buildTool({
  name: 'bg_run',
  description: 'Inicia um comando em background. Retorna ID. Use para builds, testes, watchers — não bloqueia.',
  schema: z.object({ command: z.string() }),
  isDestructive: true,
  async call({ command }) { return await spawnBg(command); },
});

export const bgStatusTool = buildTool({
  name: 'bg_status',
  description: 'Consulta status de um background. Status = running | done | failed.',
  schema: z.object({ id: z.string() }),
  isReadOnly: true,
  async call({ id }) {
    const t = getBg(id);
    if (!t) return { error: 'not found' };
    return { ...t, log_tail: (await readBgLog(id)).slice(-2000) };
  },
});

export const bgListTool = buildTool({
  name: 'bg_list',
  description: 'Lista todos os backgrounds (running e finalizados).',
  schema: z.object({}),
  isReadOnly: true,
  async call() { return listBg(); },
});

export const bgKillTool = buildTool({
  name: 'bg_kill',
  description: 'Mata um background pelo ID.',
  schema: z.object({ id: z.string() }),
  isDestructive: true,
  async call({ id }) { killBg(id); return { id, killed: true }; },
});
```

## Padrão de uso

```
Usuário: rode os testes e enquanto isso me ache bugs no código
LLM:
  bg_run("npm test")         → b_a1b2c3
  grep "TODO|FIXME" .         → ... lista ...
  (após 1 min de análise)
  bg_status(b_a1b2c3)         → done, exit 0, "All tests passed"
  resposta final
```

## Notificações (avançado)

Para "interromper" o agent quando bg termina, no Claude Code real existe um event bus que injeta `tool_result` mesmo sem o modelo pedir. Versão simplificada:

```ts
// dentro do loop principal, antes de cada chamada à API:
const pendingNotifs = listBg().filter(t =>
  t.status !== 'running' && !notifiedIds.has(t.id)
);
for (const n of pendingNotifs) {
  messages.push({
    role: 'user',
    content: `[bg notification] ${n.id}: status=${n.status}, exit=${n.exit_code}`,
  });
  notifiedIds.add(n.id);
}
```

## Anti-padrões

- ❌ `bg_run` para coisa rápida (1-2s) — overhead vira maior que o ganho.
- ❌ Esquecer `bg_kill` em watchers (`tsc --watch`) → processo zumbi.
- ❌ Polling apertado de `bg_status` (a cada turno) → bloat de tokens.
- ❌ Detached sem capturar PID → órfãos no sistema.

## ✓ Validar

```bash
npm run dev -- chat "Rode 'sleep 5 && echo done' em background, depois liste todos os bg, espere e leia o log final"
ls ~/.claude-mini/bg/
```

## Próximo

→ [s09. Teams — `InProcessTeammate`](s09-teams.md)
