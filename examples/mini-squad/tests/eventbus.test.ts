import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/events/event-bus.js';
import { Ralph } from '../src/ralph/ralph.js';

describe('EventBus', () => {
  it('publica evento para listeners inscritos', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('agent.started', fn);
    bus.emit('agent.started', { sessionId: 's', agentName: 'A' });
    expect(fn).toHaveBeenCalledWith({ sessionId: 's', agentName: 'A' });
  });

  it('off remove listener', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const off = bus.on('agent.completed', fn);
    off();
    bus.emit('agent.completed', { sessionId: 's', agentName: 'A' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('listener que joga não derruba o emitter', () => {
    const bus = new EventBus();
    bus.on('agent.error', () => {
      throw new Error('boom');
    });
    expect(() =>
      bus.emit('agent.error', { sessionId: 's', agentName: 'A', error: 'x' }),
    ).not.toThrow();
  });
});

describe('Ralph', () => {
  it('imprime eventos formatados', () => {
    const bus = new EventBus();
    const lines: string[] = [];
    const r = new Ralph(bus, (l) => lines.push(l));
    r.start();
    bus.emit('agent.progress', { sessionId: 's', progress: 50 });
    r.stop();
    expect(lines.some((l) => l.includes('50%'))).toBe(true);
  });
});
