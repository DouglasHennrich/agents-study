import type { EventBus } from '../events/event-bus.js';

/**
 * Ralph: monitor persistente em terminal. Inscreve-se no EventBus
 * e imprime o que está acontecendo. Inspirado em
 * `packages/squad-sdk/src/ralph/`.
 */
export class Ralph {
  private unsubs: Array<() => void> = [];

  constructor(
    private bus: EventBus,
    private out: (line: string) => void = (l) => process.stdout.write(l + '\n'),
  ) {}

  start(): void {
    const fmt = (label: string, p: any) =>
      `[${new Date().toISOString().slice(11, 19)}] ${label} ${JSON.stringify(p)}`;

    this.unsubs = [
      this.bus.on('agent.started', (p) => this.out(fmt('▶  agent.started', p))),
      this.bus.on('agent.completed', (p) => this.out(fmt('✓  agent.completed', p))),
      this.bus.on('agent.error', (p) => this.out(fmt('✗  agent.error', p))),
      this.bus.on('agent.progress', (p) =>
        this.out(fmt(`…  ${p.progress}%`, p)),
      ),
      this.bus.on('tool.called', (p) => this.out(fmt('→  tool.called', p))),
      this.bus.on('tool.completed', (p) => this.out(fmt('←  tool.completed', p))),
      this.bus.on('tool.denied', (p) => this.out(fmt('⛔  tool.denied', p))),
      this.bus.on('router.routed', (p) => this.out(fmt('↪  router.routed', p))),
    ];
  }

  stop(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }
}
