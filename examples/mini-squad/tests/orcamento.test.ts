import { describe, it, expect } from 'vitest';
import {
  orquestrarOrcamento,
  consolidar,
  type Pedido,
} from '../src/orcamento/index.js';

const pedido: Pedido = {
  id: 'T-1',
  cliente: 'Teste',
  itens: [
    { sku: 'A-1', descricao: 'A', quantidade: 2 },
    { sku: 'B-2', descricao: 'B', quantidade: 1 },
  ],
};

describe('orquestrador de orçamento', () => {
  it('produz relatório com 3 cotações e melhor cenário por item', async () => {
    const r = await orquestrarOrcamento(pedido);
    expect(r.cotacoes).toHaveLength(3);
    expect(r.melhorPorItem).toHaveLength(2);
    expect(r.totalMelhorCenario).toBeGreaterThan(0);
    // melhor preço deve ser <= preço de qualquer plataforma para o mesmo SKU
    for (const m of r.melhorPorItem) {
      const precos = r.cotacoes.flatMap((c) =>
        c.itens.filter((i) => i.sku === m.sku).map((i) => i.precoUnit),
      );
      expect(m.precoUnit).toBe(Math.min(...precos));
    }
  });

  it('consolidar é determinístico', () => {
    const c1 = consolidar(pedido, []);
    expect(c1.melhorPorItem).toEqual([]);
    expect(c1.totalMelhorCenario).toBe(0);
  });
});
