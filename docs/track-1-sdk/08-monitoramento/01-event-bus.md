# 01. EventBus typed pub/sub

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Um EventBus desacopla **emissores** (Runtime, Router, Tools) de **consumidores** (CLI, Ralph, métricas, webhooks). Tipado, evita strings mágicas e dá auto-complete em IDE.

## Como o Squad faz

`packages/squad-sdk/src/events/` define um `EventMap` (interface chave→payload) e um `EventBus` genérico. Eventos viram **a fonte de verdade observável** do sistema.

## Construa o seu

[`src/events/event-bus.ts`](../../examples/mini-squad/src/events/event-bus.ts):

```ts
const bus = new EventBus();

const off = bus.on('tool.called', (p) => console.log('tool:', p.tool));
bus.emit('tool.called', { sessionId: 's1', tool: 'fs_write', args: {} });
off();
```

Pontos:

- `on` retorna `unsubscribe` (padrão React-friendly).
- Listeners falhos não derrubam o emitter (`try/catch` interno).
- `EventMap` é a fonte de verdade dos tipos.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- eventbus
# ✓ EventBus > publica evento para listeners inscritos
# ✓ EventBus > off remove listener
# ✓ EventBus > listener que joga não derruba o emitter
```
