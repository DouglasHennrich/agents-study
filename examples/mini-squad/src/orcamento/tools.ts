import { z } from 'zod';
import type { Tool } from '../tools/types.js';
import type { CotacaoPlataforma } from './domain.js';

/**
 * Mocks determinísticos das 3 plataformas. Em produção, cada uma viraria
 * uma chamada HTTP / IPC real. Aqui o "preço" é função simples do SKU
 * + ruído por plataforma — garante que sempre haja variação para
 * o consolidador escolher.
 */
function precoBase(sku: string): number {
  const seed = [...sku].reduce((a, c) => a + c.charCodeAt(0), 0);
  return 50 + (seed % 200);
}

function montarCotacao(
  plataforma: CotacaoPlataforma['plataforma'],
  itens: { sku: string; quantidade: number }[],
  ajuste: number,
): CotacaoPlataforma {
  const cot: CotacaoPlataforma['itens'] = itens.map((it) => {
    const p = +(precoBase(it.sku) * ajuste).toFixed(2);
    return {
      sku: it.sku,
      precoUnit: p,
      disponivel: true,
      prazoDias: plataforma === 'Desktop' ? 1 : 3,
    };
  });
  const total = +cot
    .reduce((s, c, i) => s + c.precoUnit * itens[i].quantidade, 0)
    .toFixed(2);
  return {
    plataforma,
    moeda: 'BRL',
    geradaEm: new Date().toISOString(),
    itens: cot,
    total,
  };
}

const ItensInput = z.object({
  itens: z.array(
    z.object({ sku: z.string(), quantidade: z.number().int().positive() }),
  ),
});

export const cotarWebA: Tool<z.infer<typeof ItensInput>, CotacaoPlataforma> = {
  name: 'cotar_web_a',
  description: 'Cota itens na Plataforma Web A (mock HTTP).',
  input: ItensInput,
  async run({ itens }) {
    return montarCotacao('WebA', itens, 1.0);
  },
};

export const cotarWebB: Tool<z.infer<typeof ItensInput>, CotacaoPlataforma> = {
  name: 'cotar_web_b',
  description: 'Cota itens na Plataforma Web B (mock HTTP).',
  input: ItensInput,
  async run({ itens }) {
    return montarCotacao('WebB', itens, 0.95);
  },
};

export const cotarDesktop: Tool<z.infer<typeof ItensInput>, CotacaoPlataforma> = {
  name: 'cotar_desktop',
  description:
    'Cota itens no app desktop (Windows) via mock HTTP local. ' +
    'Em produção: substituir por chamada IPC / API local do app.',
  input: ItensInput,
  async run({ itens }) {
    return montarCotacao('Desktop', itens, 1.05);
  },
};

export const cotacaoTools: Tool[] = [cotarWebA, cotarWebB, cotarDesktop];
