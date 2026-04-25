# 02. Ralph monitor

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

**Ralph** é um monitor persistente em terminal que se inscreve no EventBus e mostra, em tempo real, o que cada agent está fazendo. Sem ele, debugar multi-agent é impossível.

## Como o Squad faz

`packages/squad-sdk/src/ralph/` é um processo (ou módulo embutido) que assina **todos** os eventos relevantes e formata em uma timeline com cores/ícones (`▶`, `✓`, `✗`, `→`, `←`, `⛔`).

## Construa o seu

[`src/ralph/ralph.ts`](../../examples/mini-squad/src/ralph/ralph.ts):

```ts
const bus = new EventBus();
const ralph = new Ralph(bus);
ralph.start();

// ... agente roda e emite eventos ...

ralph.stop();
```

Saída:

```
[12:00:01] ▶  agent.started {"sessionId":"...","agentName":"Coordinator"}
[12:00:02] →  tool.called {"tool":"squad_route", ...}
[12:00:03] ←  tool.completed {"tool":"squad_route", ...}
[12:00:04] ↪  router.routed {"to":"WebAgentA","input":"..."}
[12:00:08] …  50% {"sessionId":"...","progress":50}
[12:00:12] ✓  agent.completed {"sessionId":"...","agentName":"Coordinator"}
```

### Extensões fáceis (exercício)

- Salvar o stream em arquivo (`.mini-squad/ralph.log`).
- Filtrar por `sessionId`.
- Exportar para Prometheus / OpenTelemetry.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- eventbus
# ✓ Ralph > imprime eventos formatados
```
