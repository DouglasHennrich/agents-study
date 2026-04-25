# 02. Agents especializados

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Em vez de **um** agent gigante que cota em todas as plataformas, criamos **um agent por plataforma** + um **Coordinator** que delega. Vantagens:

- Cada agent tem prompt curto e tools mínimas (princípio do menor privilégio).
- Falha em uma plataforma não derruba as outras.
- Paralelismo natural via `Promise.all` ou tools concorrentes.

## Como o Squad faz

Charters declarativos por agent. O Coordinator usa `squad_route` para delegar; o Router cria sub-sessions paralelas.

## Construa o seu

[`src/orcamento/charters.ts`](../../examples/mini-squad/src/orcamento/charters.ts):

| Agent | Tools |
|---|---|
| `Coordinator` | `squad_route`, `squad_status`, `squad_decide`, `cotar_*` (para versão direta) |
| `WebAgentA` | `cotar_web_a`, `squad_status` |
| `WebAgentB` | `cotar_web_b`, `squad_status` |
| `DesktopAgent` | `cotar_desktop`, `squad_status` |

> Note: o Coordinator também tem acesso direto às tools de cotação. Isso permite duas estratégias: **(a)** delegar a cada sub-agent (didático), **(b)** chamar tools direto em paralelo (mais rápido — usado no nosso `orquestrarOrcamento`).

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- orcamento
# ✓ orquestrador de orçamento > produz relatório com 3 cotações ...
```
