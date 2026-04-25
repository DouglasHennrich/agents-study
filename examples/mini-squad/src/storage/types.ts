import type { AgentSession } from '../session/session.js';

/**
 * Interface mínima para persistência de sessões e blobs.
 * Inspirada em `packages/squad-sdk/src/storage/`.
 */
export interface StorageProvider {
  saveSession(session: AgentSession): Promise<void>;
  loadSession(id: string): Promise<AgentSession | null>;
  listSessions(): Promise<AgentSession[]>;
  deleteSession(id: string): Promise<void>;

  /** Blobs livres (memória de tools, decisões, relatórios). */
  putBlob(key: string, value: unknown): Promise<void>;
  getBlob<T = unknown>(key: string): Promise<T | null>;
}
