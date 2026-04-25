/**
 * EventBus typed pub/sub. Inspirado em
 * `packages/squad-sdk/src/events/`.
 */

export interface EventMap {
  'agent.started': { sessionId: string; agentName: string };
  'agent.completed': { sessionId: string; agentName: string; result?: unknown };
  'agent.error': { sessionId: string; agentName: string; error: string };
  'agent.token': { sessionId: string; delta: string };
  'agent.progress': { sessionId: string; progress: number; note?: string };
  'tool.called': { sessionId: string; tool: string; args: unknown };
  'tool.completed': { sessionId: string; tool: string; output: unknown };
  'tool.denied': { sessionId: string; tool: string; reason: string };
  'router.routed': { from?: string; to: string; input: string };
}

export type EventName = keyof EventMap;
export type Listener<E extends EventName> = (payload: EventMap[E]) => void;

export class EventBus {
  private listeners = new Map<EventName, Set<Listener<any>>>();

  on<E extends EventName>(event: E, fn: Listener<E>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)!.delete(fn);
  }

  emit<E extends EventName>(event: E, payload: EventMap[E]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch {
        /* listener não pode quebrar o emitter */
      }
    }
  }
}
