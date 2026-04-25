// Background tasks (s08)
import { spawn, ChildProcess } from 'node:child_process';
import { writeFile, readFile, appendFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

export interface BgTask {
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

export function configureBgDir(dir: string): void { defaultDir = dir; }
let defaultDir = `${process.env.HOME}/.claude-mini/bg`;

export async function spawnBg(command: string): Promise<BgTask> {
  await mkdir(defaultDir, { recursive: true });
  const id = `b_${randomBytes(4).toString('hex')}`;
  const logFile = join(defaultDir, `${id}.log`);
  await writeFile(logFile, '');
  const child = spawn('bash', ['-lc', command], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => { appendFile(logFile, d).catch(() => {}); });
  child.stderr.on('data', (d) => { appendFile(logFile, d).catch(() => {}); });
  child.on('close', (code) => {
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
export function listBg(): BgTask[] { return [...tasks.values()]; }
export async function readBgLog(id: string): Promise<string> {
  const t = tasks.get(id);
  if (!t) throw new Error(`bg ${id} not found`);
  return await readFile(t.logFile, 'utf-8');
}
export function killBg(id: string): boolean {
  const p = procs.get(id);
  if (!p) return false;
  p.kill('SIGTERM');
  return true;
}
export function resetBg(): void { tasks.clear(); procs.clear(); }
