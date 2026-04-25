import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentSession } from '../session/session.js';
import type { StorageProvider } from './types.js';

/**
 * Persistência em sistema de arquivos. Layout:
 *
 *   <root>/
 *     sessions/<id>.json
 *     blobs/<key-base64>.json
 *
 * Escrita atômica via tmp + rename para suportar crash recovery.
 */
export class FileStorage implements StorageProvider {
  constructor(private root: string) {}

  private async ensureDir(p: string) {
    await fs.mkdir(p, { recursive: true });
  }

  private sessionPath(id: string) {
    return path.join(this.root, 'sessions', `${id}.json`);
  }
  private blobPath(key: string) {
    const safe = Buffer.from(key).toString('base64url');
    return path.join(this.root, 'blobs', `${safe}.json`);
  }

  private async writeAtomic(file: string, data: string) {
    await this.ensureDir(path.dirname(file));
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, data, 'utf8');
    await fs.rename(tmp, file);
  }

  async saveSession(s: AgentSession) {
    await this.writeAtomic(this.sessionPath(s.id), JSON.stringify(s, null, 2));
  }

  async loadSession(id: string) {
    try {
      const raw = await fs.readFile(this.sessionPath(id), 'utf8');
      return JSON.parse(raw) as AgentSession;
    } catch (err: any) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async listSessions() {
    const dir = path.join(this.root, 'sessions');
    try {
      const files = await fs.readdir(dir);
      const out: AgentSession[] = [];
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const raw = await fs.readFile(path.join(dir, f), 'utf8');
        out.push(JSON.parse(raw));
      }
      return out;
    } catch (err: any) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async deleteSession(id: string) {
    await fs.rm(this.sessionPath(id), { force: true });
  }

  async putBlob(k: string, v: unknown) {
    await this.writeAtomic(this.blobPath(k), JSON.stringify(v, null, 2));
  }

  async getBlob<T>(k: string) {
    try {
      const raw = await fs.readFile(this.blobPath(k), 'utf8');
      return JSON.parse(raw) as T;
    } catch (err: any) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }
}
