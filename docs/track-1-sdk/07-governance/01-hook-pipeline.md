# 01. Hook Pipeline

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Hooks são **interceptadores** entre o agent e o mundo exterior. Em três pontos críticos:

| Hook | Quando dispara | Pode fazer |
|---|---|---|
| `before_tool` | antes de chamar uma tool | bloquear, reescrever args |
| `after_tool` | depois da resposta da tool | mascarar/transformar output |
| `before_llm` | antes de cada chamada ao LLM | injetar/limpar mensagens (PII) |

A pipeline executa hooks em ordem; cada um devolve `allow`, `rewrite` ou `deny`.

## Como o Squad faz

`packages/squad-sdk/src/hooks/` define o `HookPipeline` e fornece hooks built-in (file guards, PII scrub, rate limit, reviewer lockout). Charters declaram quais hooks aplicam.

## Construa o seu

[`src/hooks/pipeline.ts`](../../examples/mini-squad/src/hooks/pipeline.ts):

```ts
const p = new HookPipeline()
  .register(fileWriteGuard({ allow: ['docs/**'] }))
  .register(piiScrubHook('before_llm'))
  .register(rateLimitHook({ limit: 10, windowMs: 60_000 }));

const decision = await p.dispatch({ kind: 'before_tool', call, ctx });
if (decision.type === 'deny') {
  // alimenta a tool message com o motivo — agent se corrige
}
```

Ponto crítico: hooks são **composáveis e ordenados**. Um `rewrite` passa a payload modificada para os hooks seguintes.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- hooks
# ✓ HookPipeline + fileWriteGuard > permite path dentro do allow
# ✓ HookPipeline + fileWriteGuard > nega path fora do allow
```
