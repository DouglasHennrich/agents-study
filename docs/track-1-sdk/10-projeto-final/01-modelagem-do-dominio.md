# 01. Modelagem do domínio

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Antes de escrever um agent, modele o **domínio** em tipos puros — isso desacopla regra de negócio do LLM e torna a orquestração testável sem tokens.

## Como o Squad faz

Squad encoraja `domain types` separados de `agent types`. O LLM produz texto/tool calls; o domínio é onde o **valor real** vive.

## Construa o seu

[`src/orcamento/domain.ts`](../../examples/mini-squad/src/orcamento/domain.ts):

```ts
interface Pedido { id; cliente; itens: Item[] }
interface Item { sku; descricao; quantidade }
interface CotacaoPlataforma {
  plataforma: 'WebA' | 'WebB' | 'Desktop';
  moeda: 'BRL' | 'USD';
  itens: { sku; precoUnit; disponivel; prazoDias? }[];
  total;
}
interface RelatorioConsolidado {
  pedidoId; cotacoes; melhorPorItem; totalMelhorCenario;
}
```

Princípios:

- **Sem dependência de framework** nesta camada.
- Tipos pequenos e composáveis.
- Datas como `string` ISO — fáceis de serializar/diff/log.

## ✓ Validar

```bash
cd examples/mini-squad
npm run build
# tipos puros — só verificamos que compilam.
```
