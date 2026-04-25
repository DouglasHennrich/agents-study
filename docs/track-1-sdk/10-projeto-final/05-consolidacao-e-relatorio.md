# 05. Consolidação e relatório

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Consolidação responde: **qual plataforma oferece o melhor preço por item?** E qual o **total do melhor cenário**?

A regra é trivial — `min` por SKU — mas o **relatório** importa: precisa ser legível, auditável e versionável (Markdown).

## Como o Squad faz

Squad reporta resultados via `squad_decide` (auditoria) e geralmente serializa em Markdown ou JSON para PRs.

## Construa o seu

[`src/orcamento/consolidacao.ts`](../../examples/mini-squad/src/orcamento/consolidacao.ts) tem duas funções:

- `consolidar(pedido, cotacoes)` — devolve `RelatorioConsolidado`.
- `relatorioMarkdown(r)` — renderiza como Markdown.

Estrutura do relatório:

```md
# Orçamento — pedido PED-001
- Cliente: ACME
- Gerado em: 2026-04-23T12:00:00.000Z

## Cotações por plataforma
### WebA (BRL) — total 1234.56
| SKU | Preço unit | Disponível | Prazo (d) |
| ... |

## Melhor cenário
| SKU | Plataforma | Preço unit |
| MOUSE-OPT-01 | WebB | 47.50 |
**Total melhor cenário: R$ 987.65**
```

### Boas práticas

- **Sempre incluir timestamp e moeda** — auditoria.
- Markdown > PDF — diff em git.
- Se houver `erro` em alguma plataforma, mostre claramente em vez de ocultar.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- orcamento
# Inclui o teste `consolidar é determinístico`
```
