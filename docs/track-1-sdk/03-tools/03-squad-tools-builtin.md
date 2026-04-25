# 03. As 5 tools built-in do Squad

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

O Squad é opinativo: cada agent ganha **5 tools default** que padronizam orquestração, decisão e auditoria. Isso evita que cada projeto reinvente "como delegar" ou "como registrar progresso".

## Como o Squad faz

| Tool | Propósito |
|---|---|
| `squad_route` | Delega para outro agent (input para o Router). |
| `squad_decide` | Registra uma decisão (entra no event log para auditoria). |
| `squad_memory` | Memória chave-valor por agent/sessão. |
| `squad_status` | Reporta progresso 0-100 (Ralph consome — Phase 9). |
| `squad_skill` | Invoca um workflow nomeado declarado no charter. |

Convenção: prefixo `squad_` reservado para built-ins. Tools custom usam outro prefixo.

## Construa o seu

Em [`src/tools/builtin.ts`](../../examples/mini-squad/src/tools/builtin.ts) implementamos versões simplificadas de todas as 5. As built-ins **emitem o intent** mas a execução real (rotear, persistir decisão, emitir progresso) é feita pelo Runtime que monta tudo:

- `squad_route` apenas devolve `{ routedTo: to }`. O Router (Phase 5) intercepta esse retorno e cria a sub-sessão.
- `squad_status` é no-op aqui; a HookPipeline (Phase 8) republica como `agent.progress` no EventBus (Phase 9).
- `squad_memory` usa um `Map` em memória — substituível por `StorageProvider` (Phase 7) sem mudar a interface.

### Por que tools como "intent" + interceptação?

Permite **substituir a implementação sem mexer no agent**: o LLM continua chamando `squad_status({ progress: 50 })`, e quem decide se isso vai pra stdout, log, Slack ou Ralph é o runtime. Inversão de controle clássica.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- tools
# ✓ ToolRegistry > expõe schemas em formato JSON Schema   (verifica squad_route registrado)
# ✓ ToolRegistry > squad_memory persiste entre chamadas no processo
```
