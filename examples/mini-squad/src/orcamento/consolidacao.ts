import type {
  CotacaoPlataforma,
  Pedido,
  RelatorioConsolidado,
} from './domain.js';

/**
 * Consolida cotações de múltiplas plataformas: para cada item,
 * escolhe o menor preço disponível e calcula o total.
 */
export function consolidar(
  pedido: Pedido,
  cotacoes: CotacaoPlataforma[],
): RelatorioConsolidado {
  const melhor: RelatorioConsolidado['melhorPorItem'] = [];
  let total = 0;

  for (const item of pedido.itens) {
    const candidatas = cotacoes
      .map((c) => {
        const linha = c.itens.find(
          (i) => i.sku === item.sku && i.disponivel,
        );
        return linha ? { plataforma: c.plataforma, preco: linha.precoUnit } : null;
      })
      .filter((x): x is { plataforma: CotacaoPlataforma['plataforma']; preco: number } => x !== null);

    if (!candidatas.length) continue;
    const best = candidatas.reduce((a, b) => (a.preco <= b.preco ? a : b));
    melhor.push({ sku: item.sku, plataforma: best.plataforma, precoUnit: best.preco });
    total += best.preco * item.quantidade;
  }

  return {
    pedidoId: pedido.id,
    cliente: pedido.cliente,
    cotacoes,
    melhorPorItem: melhor,
    totalMelhorCenario: +total.toFixed(2),
    geradoEm: new Date().toISOString(),
  };
}

export function relatorioMarkdown(r: RelatorioConsolidado): string {
  const linhas: string[] = [
    `# Orçamento — pedido ${r.pedidoId}`,
    ``,
    `- **Cliente**: ${r.cliente}`,
    `- **Gerado em**: ${r.geradoEm}`,
    ``,
    `## Cotações por plataforma`,
    ``,
  ];

  for (const c of r.cotacoes) {
    linhas.push(`### ${c.plataforma} (${c.moeda}) — total ${c.total}`);
    linhas.push(``);
    linhas.push(`| SKU | Preço unit | Disponível | Prazo (d) |`);
    linhas.push(`|---|---|---|---|`);
    for (const i of c.itens) {
      linhas.push(
        `| ${i.sku} | ${i.precoUnit} | ${i.disponivel ? 'sim' : 'não'} | ${i.prazoDias ?? '-'} |`,
      );
    }
    linhas.push(``);
  }

  linhas.push(`## Melhor cenário`);
  linhas.push(``);
  linhas.push(`| SKU | Plataforma | Preço unit |`);
  linhas.push(`|---|---|---|`);
  for (const m of r.melhorPorItem) {
    linhas.push(`| ${m.sku} | ${m.plataforma} | ${m.precoUnit} |`);
  }
  linhas.push(``);
  linhas.push(`**Total melhor cenário: R$ ${r.totalMelhorCenario.toFixed(2)}**`);
  return linhas.join('\n');
}
