# s12. Worktree Isolation — git worktree por task

> *"Múltiplos agents mexendo no mesmo `cwd` = corrupção garantida."* Cada agent ganha um **git worktree** próprio.

## Como Claude Code faz

📂 `src/tools/EnterWorktreeTool/`, `ExitWorktreeTool/`

- `enter_worktree(branch?)` cria `git worktree add ../proj-<id> [branch]`, troca o `cwd` lógico do agent.
- Tools subsequentes (`file_write`, `bash`) operam dentro do worktree.
- `exit_worktree(strategy)`:
  - `merge` — `git merge` no main + remove worktree.
  - `discard` — `git worktree remove --force`.
  - `keep` — só sai do worktree, deixa para revisão humana.

## Por que git worktree (não branch comum)?

| | Branch + checkout | Worktree |
|---|---|---|
| Pasta física | 1 (mesma) | N (separadas) |
| Permite paralelismo | ❌ | ✅ |
| Switch | reescreve files | só muda diretório |
| Conflito de processos | ⚠️ | ✅ isolado |

Crítico quando rodando 5 agents em paralelo (s11): cada um na sua pasta, builds não brigam.

## Versão didática

📄 `src/worktree/manager.ts`

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);

export interface Worktree {
  id: string;
  path: string;
  branch: string;
  base: string;
}

const worktrees = new Map<string, Worktree>();

export async function enterWorktree(opts: { repo: string; branch?: string }): Promise<Worktree> {
  const id = `wt_${Math.random().toString(36).slice(2, 10)}`;
  const branch = opts.branch ?? `claude-mini/${id}`;
  const path = await mkdtemp(join(tmpdir(), `wt-${id}-`));

  // cria branch a partir do HEAD se não existir
  try { await exec('git', ['-C', opts.repo, 'rev-parse', '--verify', branch]); }
  catch { await exec('git', ['-C', opts.repo, 'branch', branch]); }

  await exec('git', ['-C', opts.repo, 'worktree', 'add', path, branch]);
  const wt: Worktree = { id, path, branch, base: opts.repo };
  worktrees.set(id, wt);
  return wt;
}

export async function exitWorktree(id: string, strategy: 'merge' | 'discard' | 'keep'): Promise<{ ok: true; merged?: boolean }> {
  const wt = worktrees.get(id);
  if (!wt) throw new Error(`worktree ${id} não existe`);

  if (strategy === 'merge') {
    // commit local pendente?
    await exec('git', ['-C', wt.path, 'add', '-A']);
    try { await exec('git', ['-C', wt.path, 'commit', '-m', `claude-mini: ${id}`]); } catch {}
    await exec('git', ['-C', wt.base, 'merge', '--no-ff', wt.branch, '-m', `merge ${wt.branch}`]);
  }
  if (strategy !== 'keep') {
    await exec('git', ['-C', wt.base, 'worktree', 'remove', '--force', wt.path]);
    if (strategy === 'discard') await rm(wt.path, { recursive: true, force: true }).catch(() => {});
    worktrees.delete(id);
  }
  return { ok: true, merged: strategy === 'merge' };
}

export function getWorktree(id: string) { return worktrees.get(id); }
export function listWorktrees() { return [...worktrees.values()]; }
```

## Tools

📄 `src/tools/builtin/worktree.ts`

```ts
import { z } from 'zod';
import { buildTool } from '../registry.js';
import { enterWorktree, exitWorktree, getWorktree, listWorktrees } from '../../worktree/manager.js';

let activeWtId: string | null = null;

export const enterWorktreeTool = buildTool({
  name: 'enter_worktree',
  description: 'Cria um git worktree isolado e troca o cwd do agent. Use ANTES de modificações arriscadas.',
  schema: z.object({
    branch: z.string().optional(),
    repo: z.string().default(process.cwd()),
  }),
  isDestructive: true,
  async call({ branch, repo }) {
    const wt = await enterWorktree({ repo, branch });
    activeWtId = wt.id;
    process.chdir(wt.path);
    return wt;
  },
});

export const exitWorktreeTool = buildTool({
  name: 'exit_worktree',
  description: 'Sai do worktree atual com estratégia merge|discard|keep.',
  schema: z.object({
    strategy: z.enum(['merge', 'discard', 'keep']),
  }),
  isDestructive: true,
  async call({ strategy }) {
    if (!activeWtId) return { error: 'sem worktree ativo' };
    const wt = getWorktree(activeWtId)!;
    const res = await exitWorktree(activeWtId, strategy);
    process.chdir(wt.base);
    activeWtId = null;
    return res;
  },
});

export const worktreeListTool = buildTool({
  name: 'worktree_list',
  description: 'Lista worktrees ativos.',
  schema: z.object({}),
  isReadOnly: true,
  async call() { return listWorktrees(); },
});
```

## Padrão de uso

```
LLM (em modo autônomo):
  enter_worktree(branch="feat/cache")
  file_write src/cache.ts
  bash npm test
  exit_worktree(strategy="merge")        ← teste passou
  ou
  exit_worktree(strategy="keep")         ← teste falhou, deixa pra humano revisar
```

## Combina com s11 (coordinator)

Cada teammate ganha worktree próprio:

```ts
// no coordinator, ao assign:
const wt = await enterWorktree({ repo: ROOT, branch: `tm/${tm.id}/${task.id}` });
deliver(tm.id, { role: 'user', content: `Trabalhe em ${wt.path}` });
```

## Anti-padrões

- ❌ `enter_worktree` sem `exit_worktree` correspondente → worktrees zumbis no `git worktree list`.
- ❌ `merge` sem rodar testes antes (regression cascade).
- ❌ Branch sem prefixo identificador (lista vira sopa).
- ❌ Worktree em mesma pasta do main (defeats the purpose).

## ✓ Validar

```bash
cd <um repo git limpo>
npm run dev -- chat "Use enter_worktree, crie src/hello.ts com console.log('hi'), rode 'cat src/hello.ts', e saia com strategy=discard. Confirme que o arquivo NÃO existe no repo principal."
git worktree list
```

## Fim da trilha 3

Você cobriu os **12 mecanismos progressivos** que tornam o Claude Code o que é:

1. The Loop · 2. Tool Dispatch · 3. Planning · 4. Sub-Agents · 5. Skills on Demand · 6. Compression · 7. Tasks · 8. Background · 9. Teams · 10. Protocols · 11. Autonomous · 12. Worktrees

Próximos passos sugeridos:

- Estude `claude-code-source-code/src/query.ts` lado a lado com seu `claude-mini/src/query.ts`.
- Implemente um mecanismo a mais não coberto aqui (ex.: prompt caching da Anthropic, fork remoto).
- Refatore seu `claude-mini` pra suportar **streaming UI** (SSE/JSONL pro terminal).
- Volte pra [Track 1 (SDK)](../track-1-sdk/README.md) ou [Track 2 (Copilot CLI)](../track-2-copilot/README.md) com olho de quem entende harness por dentro.

← [Voltar ao hub](../README.md)
