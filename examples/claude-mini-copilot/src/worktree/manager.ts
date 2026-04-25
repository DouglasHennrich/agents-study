// Worktree manager (s12)
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const exec = promisify(execFile);

export interface Worktree { id: string; path: string; branch: string; base: string }

const worktrees = new Map<string, Worktree>();

export async function enterWorktree(opts: { repo: string; branch?: string }): Promise<Worktree> {
  const id = `wt_${randomBytes(4).toString('hex')}`;
  const branch = opts.branch ?? `claude-mini/${id}`;
  const path = await mkdtemp(join(tmpdir(), `wt-${id}-`));
  try { await exec('git', ['-C', opts.repo, 'rev-parse', '--verify', branch]); }
  catch { await exec('git', ['-C', opts.repo, 'branch', branch]); }
  await exec('git', ['-C', opts.repo, 'worktree', 'add', path, branch]);
  const wt: Worktree = { id, path, branch, base: opts.repo };
  worktrees.set(id, wt);
  return wt;
}

export async function exitWorktree(
  id: string, strategy: 'merge' | 'discard' | 'keep',
): Promise<{ ok: true; merged?: boolean }> {
  const wt = worktrees.get(id);
  if (!wt) throw new Error(`worktree ${id} não existe`);
  if (strategy === 'merge') {
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

export function getWorktree(id: string): Worktree | undefined { return worktrees.get(id); }
export function listWorktrees(): Worktree[] { return [...worktrees.values()]; }
