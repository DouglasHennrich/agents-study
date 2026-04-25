# 01. Router determinístico

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Em um sistema multi-agent, **alguém precisa decidir quem atende cada pedido**. As duas grandes escolhas:

| Estratégia | Custo | Determinismo |
|---|---|---|
| LLM-router (modelo escolhe) | $$$ + latência | baixo |
| Regras determinísticas | grátis | alto |

O Squad usa **regras primeiro, LLM como fallback** — é a escolha certa para CLI rápida e auditável.

## Como o Squad faz

`packages/squad-sdk/src/router/` expõe:

- `compileRoutingRules(rules)` — pré-compila regex/prioridade.
- `matchRoute(input, compiled, fallback)` — devolve o nome do agent.

Regras vivem em YAML do charter ou em config TS, em ordem de prioridade explícita.

## Construa o seu

Veja [`src/router/router.ts`](../../examples/mini-squad/src/router/router.ts).

```ts
const r = new Router({
  defaultAgent: 'Coordinator',
  rules: [
    { match: /or[cç]amento/i, agent: 'Coordinator' },
    { match: /clima/i,        agent: 'WeatherAgent', priority: 5 },
  ],
});

r.route('como está o clima?'); // -> 'WeatherAgent'
r.route('me ajuda');           // -> 'Coordinator' (fallback)
```

Pontos:

- Regex insensível a caso por padrão.
- Empates resolvidos por `priority` (decrescente).
- Implementação stateless — fácil de testar.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- router
# ✓ Router > roteia pela primeira regra que casa
# ✓ Router > respeita prioridade
```
