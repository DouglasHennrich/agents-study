# 04. Rate limits e reviewer lockout

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Dois mecanismos defensivos:

- **Rate limit**: agent não pode chamar a mesma tool 1000 vezes por minuto (loop runaway, ataque, bug).
- **Reviewer lockout**: se o agent toma N decisões negadas seguidas, ele é **travado** até reset humano. Evita que o sistema fique iterando sobre uma decisão proibida.

## Como o Squad faz

Hooks configuráveis por charter. O `reviewer-lockout` integra com EventBus: cada `tool.denied` incrementa um contador; ao atingir o limite, o agent é congelado e um evento `agent.locked` é emitido.

## Construa o seu

Em [`src/hooks/builtin.ts`](../../examples/mini-squad/src/hooks/builtin.ts):

- `rateLimitHook({ limit, windowMs })` — janela deslizante por `(sessionId, tool)`.
- `reviewerLockout({ maxDenies })` — esqueleto; integração completa com EventBus fica como exercício (ouvir `tool.denied` e chamar `onDeny`).

```ts
const pipeline = new HookPipeline()
  .register(rateLimitHook({ limit: 30, windowMs: 60_000 }))
  .register(reviewerLockout({ maxDenies: 5 }));
```

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- hooks
# ✓ rateLimitHook > bloqueia após exceder o limite
```
