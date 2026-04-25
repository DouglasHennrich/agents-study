# 06. CLI final — `mini-squad orcar`

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Tudo que construímos converge em um único comando:

```bash
mini-squad orcar --pedido pedido.json --out orcamento.md
```

## Como o Squad faz

Cada caso de uso vira um subcomando da CLI consumindo a SDK. Comandos não conhecem internals — só compõem peças.

## Construa o seu

O comando `orcar` em [`src/cli/index.ts`](../../examples/mini-squad/src/cli/index.ts):

1. Lê o JSON do pedido.
2. Cria EventBus + Ralph (monitor).
3. Chama `orquestrarOrcamento(pedido, bus)` — fan-out paralelo nas 3 plataformas.
4. Renderiza com `relatorioMarkdown` e grava em disco.

Pedido de exemplo está em [`examples-app/pedido.json`](../../examples/mini-squad/examples-app/pedido.json).

## ✓ Validar

```bash
cd examples/mini-squad
npm run build

# rodar via tsx (sem precisar de npm link)
npx tsx src/cli/index.ts orcar \
  --pedido examples-app/pedido.json \
  --out orcamento.md \
  --no-ralph

# Saída esperada:
#   ✓ relatório salvo em orcamento.md
#     total melhor cenário: R$ ...

cat orcamento.md
# Veja a tabela de cotações por plataforma + melhor cenário consolidado.
```

Se quiser ver o Ralph em ação, omita `--no-ralph`:

```bash
npx tsx src/cli/index.ts orcar -p examples-app/pedido.json -o orcamento.md
# [12:00:01] ▶  agent.started ...
# [12:00:01] …  80% {"sessionId":"...","note":"cotacoes-prontas"}
# [12:00:01] ✓  agent.completed ...
# ✓ relatório salvo em orcamento.md
```

🎉 **Você terminou o tutorial.**

## Próximos passos sugeridos

- Plugar uma versão real do `cotar_desktop` falando com um app local via HTTP.
- Substituir `Promise.all` por loop ReAct via `Runtime` + `squad_route` para versão 100% agentica.
- Adicionar `SqliteStorage` (exercício da Phase 7).
- Criar um agent de "negociação" que toma o relatório e sugere onde concentrar o pedido para ganhar desconto por volume.
- Integrar com o **Watch Mode** do Squad para disparar orçamentos quando uma issue for aberta no GitHub.
