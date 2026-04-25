import { randomUUID } from 'node:crypto';
import type { Message } from '../client/types.js';
import type { CastedAgent } from '../casting/casting-engine.js';
import type { StorageProvider } from '../storage/types.js';

export type SessionStatus = 'idle' | 'running' | 'done' | 'error';

export interface AgentSession {
  id: string;
  agentName: string;
  status: SessionStatus;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  parentId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Pool de sessions com persistência opcional.
 * Inspirado em `packages/squad-sdk/src/session/`.
 */
export class SessionPool {
  private sessions = new Map<string, AgentSession>();

  constructor(private storage?: StorageProvider) {}

  async create(agent: CastedAgent, parentId?: string): Promise<AgentSession> {
    const now = new Date().toISOString();
    const session: AgentSession = {
      id: randomUUID(),
      agentName: agent.charter.name,
      status: 'idle',
      messages: [{ role: 'system', content: agent.systemPrompt }],
      createdAt: now,
      updatedAt: now,
      parentId,
    };
    this.sessions.set(session.id, session);
    await this.storage?.saveSession(session);
    return session;
  }

  get(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  async update(id: string, patch: Partial<AgentSession>): Promise<void> {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`Sessão não encontrada: ${id}`);
    Object.assign(s, patch, { updatedAt: new Date().toISOString() });
    await this.storage?.saveSession(s);
  }

  async appendMessages(id: string, msgs: Message[]): Promise<void> {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`Sessão não encontrada: ${id}`);
    s.messages.push(...msgs);
    s.updatedAt = new Date().toISOString();
    await this.storage?.saveSession(s);
  }

  async resume(id: string): Promise<AgentSession> {
    if (this.sessions.has(id)) return this.sessions.get(id)!;
    if (!this.storage) {
      throw new Error('Resume requer StorageProvider configurado');
    }
    const s = await this.storage.loadSession(id);
    if (!s) throw new Error(`Sessão não encontrada no storage: ${id}`);
    this.sessions.set(s.id, s);
    return s;
  }

  list(): AgentSession[] {
    return [...this.sessions.values()];
  }
}
