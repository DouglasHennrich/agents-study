import type { AgentSession } from '../session/session.js';
import type { StorageProvider } from './types.js';

export class InMemoryStorage implements StorageProvider {
  private sessions = new Map<string, AgentSession>();
  private blobs = new Map<string, unknown>();

  async saveSession(s: AgentSession) {
    this.sessions.set(s.id, structuredClone(s));
  }
  async loadSession(id: string) {
    return structuredClone(this.sessions.get(id) ?? null);
  }
  async listSessions() {
    return [...this.sessions.values()].map((s) => structuredClone(s));
  }
  async deleteSession(id: string) {
    this.sessions.delete(id);
  }
  async putBlob(k: string, v: unknown) {
    this.blobs.set(k, structuredClone(v));
  }
  async getBlob<T>(k: string) {
    return (structuredClone(this.blobs.get(k)) as T) ?? null;
  }
}
