# 01. ToolRegistry pattern

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Tools são **funções nomeadas** que o LLM pode chamar. Para que o agent saiba o que existe, precisamos de um **registry**: um mapa `nome → { schema, implementação }`. O registry expõe duas operações:

1. `schemas()` — lista de descrições para enviar ao LLM.
2. `run(name, args, ctx)` — executa uma tool com validação.

## Como o Squad faz

Em `packages/squad-sdk/src/tools/` o Squad mantém um registry estático com tools built-in (`squad_route`, `squad_decide`, `squad_memory`, `squad_status`, `squad_skill`) e permite que charters/plugins registrem mais. A descoberta é declarativa: o agent ganha apenas as tools listadas no seu charter.

## Construa o seu

Criamos:

- [`src/tools/types.ts`](../../examples/mini-squad/src/tools/types.ts) — `Tool<I,O>`, `ToolContext`, `ToolResult`.
- [`src/tools/registry.ts`](../../examples/mini-squad/src/tools/registry.ts) — `ToolRegistry`.

API resumida:

```ts
const reg = new ToolRegistry();

reg.register({
  name: 'echo',
  description: 'devolve a mensagem',
  input: z.object({ msg: z.string() }),
  async run({ msg }) { return msg; },
});

reg.schemas();          // -> envia ao Copilot
reg.run('echo', { msg: 'oi' }, ctx); // -> { ok: true, value: 'oi' }
```

Pontos-chave:

- O `register` lança erro em duplicatas (evita override silencioso).
- O `run` retorna `Result` discriminado (`{ ok: true | false }`) — facilita o loop ReAct sem `try/catch` espalhado.
- O `ToolContext` carrega `sessionId`, `agentName`, `signal` — útil em hooks (Phase 8).

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- tools
# ✓ ToolRegistry > registra e executa uma tool simples
# ✓ ToolRegistry > rejeita args inválidos
# ✓ ToolRegistry > expõe schemas em formato JSON Schema
# ✓ ToolRegistry > squad_memory persiste entre chamadas no processo
```
