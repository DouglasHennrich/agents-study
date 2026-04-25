// Built-in tools — read/write/bash/glob/grep
import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { join, resolve, dirname, relative } from 'node:path';
import { spawn } from 'node:child_process';
import picomatch from 'picomatch';
import { z } from 'zod';
import { buildTool } from './registry.js';

export const fileReadTool = buildTool({
  name: 'file_read',
  description: 'Lê conteúdo de um arquivo de texto.',
  schema: z.object({
    path: z.string(),
    max_bytes: z.number().int().positive().optional(),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  async call({ path, max_bytes }, ctx) {
    const abs = resolve(ctx.cwd, path);
    const content = await readFile(abs, 'utf-8');
    return max_bytes ? content.slice(0, max_bytes) : content;
  },
});

export const fileWriteTool = buildTool({
  name: 'file_write',
  description: 'Escreve conteúdo num arquivo (cria diretórios se preciso). Sobrescreve.',
  schema: z.object({ path: z.string(), content: z.string() }),
  isDestructive: true,
  async call({ path, content }, ctx) {
    const abs = resolve(ctx.cwd, path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content);
    return { written: relative(ctx.cwd, abs), bytes: content.length };
  },
});

export const bashTool = buildTool({
  name: 'bash',
  // ⚠️ Educacional: executa comandos arbitrários sem sandbox. Em produção,
  // restrinja por allowlist, isole em container/VM (Docker, Firecracker)
  // ou rode com usuário sem privilégios. `isDestructive: true` já garante
  // bloqueio em plan mode.
  description: 'Executa um comando shell. Output (stdout+stderr) limitado a ~30KB.',
  schema: z.object({
    command: z.string(),
    timeout_ms: z.number().int().positive().default(30_000),
  }),
  isDestructive: true,
  async call({ command, timeout_ms }, ctx) {
    return await new Promise<{ stdout: string; stderr: string; exit_code: number }>((resolveP) => {
      const proc = spawn('bash', ['-lc', command], { cwd: ctx.cwd });
      let stdout = '';
      let stderr = '';
      const cap = 30_000;
      proc.stdout.on('data', (d) => { stdout += d.toString().slice(0, cap - stdout.length); });
      proc.stderr.on('data', (d) => { stderr += d.toString().slice(0, cap - stderr.length); });
      const t = setTimeout(() => proc.kill('SIGKILL'), timeout_ms);
      proc.on('close', (code) => {
        clearTimeout(t);
        resolveP({ stdout, stderr, exit_code: code ?? -1 });
      });
    });
  },
});

export const globTool = buildTool({
  name: 'glob',
  description: 'Lista arquivos que casam com um pattern glob (ex.: "src/**/*.ts").',
  schema: z.object({ pattern: z.string(), max: z.number().int().positive().default(200) }),
  isReadOnly: true,
  isConcurrencySafe: true,
  async call({ pattern, max }, ctx) {
    const matcher = picomatch(pattern);
    const out: string[] = [];
    async function walk(dir: string) {
      if (out.length >= max) return;
      let entries;
      try { entries = await readdir(dir, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        if (out.length >= max) return;
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const full = join(dir, e.name);
        const rel = relative(ctx.cwd, full);
        if (e.isDirectory()) await walk(full);
        else if (matcher(rel)) out.push(rel);
      }
    }
    await walk(ctx.cwd);
    return out;
  },
});

export const grepTool = buildTool({
  name: 'grep',
  description: 'Procura por regex em arquivos casando glob. Retorna matches com path:linha.',
  schema: z.object({
    pattern: z.string(),
    glob: z.string().default('**/*'),
    max: z.number().int().positive().default(50),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  async call({ pattern, glob, max }, ctx) {
    const re = new RegExp(pattern);
    const matcher = picomatch(glob);
    const hits: string[] = [];
    async function walk(dir: string) {
      if (hits.length >= max) return;
      let entries;
      try { entries = await readdir(dir, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        if (hits.length >= max) return;
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const full = join(dir, e.name);
        const rel = relative(ctx.cwd, full);
        if (e.isDirectory()) { await walk(full); continue; }
        if (!matcher(rel)) continue;
        try {
          const content = await readFile(full, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length && hits.length < max; i++) {
            if (re.test(lines[i])) hits.push(`${rel}:${i + 1}: ${lines[i].slice(0, 200)}`);
          }
        } catch { /* binary or unreadable */ }
      }
    }
    await walk(ctx.cwd);
    return hits;
  },
});

export const enterPlanModeTool = buildTool({
  name: 'enter_plan_mode',
  description: 'Entra em modo planejamento. Tools destrutivas ficam bloqueadas. Use para tarefas com 3+ passos.',
  schema: z.object({}),
  isReadOnly: true,
  async call() {
    const { enterPlanMode } = await import('./plan-mode.js');
    enterPlanMode();
    return { mode: 'plan' };
  },
});

export const exitPlanModeTool = buildTool({
  name: 'exit_plan_mode',
  description: 'Sai do plan mode após apresentar plano completo (Markdown).',
  schema: z.object({ plan: z.string() }),
  isReadOnly: true,
  async call({ plan }) {
    const { exitPlanMode } = await import('./plan-mode.js');
    exitPlanMode();
    return { mode: 'execute', plan };
  },
});

interface TodoItem { id: number; content: string; status: 'pending' | 'in_progress' | 'completed' }
let todos: TodoItem[] = [];
export const todoWriteTool = buildTool({
  name: 'todo_write',
  description: 'Substitui a lista de TODOs do agent. APENAS UM in_progress por vez.',
  schema: z.object({
    items: z.array(z.object({
      id: z.number(),
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed']),
    })),
  }),
  isReadOnly: true,
  async call({ items }) {
    const inProg = items.filter((i) => i.status === 'in_progress');
    if (inProg.length > 1) throw new Error('apenas 1 todo pode estar in_progress');
    todos = items;
    return { count: items.length };
  },
});
export function getTodos(): TodoItem[] { return todos; }
export function resetTodos(): void { todos = []; }

import { ToolRegistry } from './registry.js';
export function defaultRegistry(): ToolRegistry {
  const reg = new ToolRegistry();
  reg.register(fileReadTool);
  reg.register(fileWriteTool);
  reg.register(bashTool);
  reg.register(globTool);
  reg.register(grepTool);
  reg.register(enterPlanModeTool);
  reg.register(exitPlanModeTool);
  reg.register(todoWriteTool);
  return reg;
}
