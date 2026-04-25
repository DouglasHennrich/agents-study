# 03. Tools de integração

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Cada plataforma vira **uma tool** com input/output tipado. O agent **não conhece HTTP** — só chama `cotar_web_a({ itens: [...] })` e recebe `CotacaoPlataforma`.

## Como o Squad faz

Tools são adapters. Quando a integração externa muda (URL nova, header diferente, API v2), você atualiza a tool — o charter e o prompt seguem iguais.

## Construa o seu

[`src/orcamento/tools.ts`](../../examples/mini-squad/src/orcamento/tools.ts) define:

- `cotar_web_a` — multiplicador 1.0
- `cotar_web_b` — multiplicador 0.95 (geralmente mais barato)
- `cotar_desktop` — multiplicador 1.05, prazo 1 dia

### Estratégia para o app Windows

**Recomendado**: o app expõe um **mock HTTP local** que simula respostas. No tutorial usamos uma função pura (`montarCotacao`) que roda no mesmo processo — equivalente didático.

Em produção:

- **(A) API HTTP/IPC local** — app expõe `localhost:7777/cotar`. Tool faz `fetch`.
- **(B) Automação UI** (`nut.js`, AutoHotkey) — só se não houver alternativa. Frágil, lento.
- **(C) Mock HTTP** — para desenvolvimento e CI.

Trocar entre (A) e (C) deve ser uma flag de ambiente — **a tool tem a mesma assinatura**.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- orcamento
```
