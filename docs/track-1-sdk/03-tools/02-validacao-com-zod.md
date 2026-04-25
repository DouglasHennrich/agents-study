# 02. Validação com Zod

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

O LLM é probabilístico — vai mandar argumentos malformados eventualmente. Sem validação, sua tool **vai quebrar** com `undefined.field` em produção. O fix é validar **toda entrada de tool** com um schema declarativo.

Por que **Zod**?

- Tipo TypeScript inferido automaticamente (`z.infer<typeof schema>`).
- Erros descritivos (jogamos de volta para o LLM, que **se corrige no próximo turno**).
- Conversível para **JSON Schema**, que é o formato exigido pelo Copilot/OpenAI.

## Como o Squad faz

O Squad usa Zod nas tools built-in e permite que tools de usuário também usem. Há um conversor interno Zod → JSON Schema.

## Construa o seu

Implementamos um conversor enxuto em [`src/tools/registry.ts`](../../examples/mini-squad/src/tools/registry.ts) — função `zodToJsonSchema`. Cobre:

- Strings, números, booleans, arrays.
- `z.enum` (vira `enum` no JSON Schema).
- `z.optional` (campo fica fora de `required`).
- Objetos aninhados (recursivo).

> Para schemas complexos (unions, tuples, refinements), considere a lib oficial [`zod-to-json-schema`](https://www.npmjs.com/package/zod-to-json-schema). Aqui mantemos manual por didática.

### Loop de auto-correção

Quando `safeParse` falha, devolvemos a mensagem do Zod ao LLM como conteúdo da `tool message`:

```ts
{ ok: false, error: 'Args inválidos: Required at "msg"' }
```

O modelo lê isso na próxima iteração e corrige. Esse é o "self-healing" típico de agents.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- tools
# Inclui o teste "rejeita args inválidos" que cobre o caminho Zod → erro.
```
