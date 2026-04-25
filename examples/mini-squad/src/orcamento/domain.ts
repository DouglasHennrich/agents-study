/**
 * Modelagem do domínio do projeto final: orçamentos multi-plataforma.
 */

export interface Item {
  sku: string;
  descricao: string;
  quantidade: number;
}

export interface Pedido {
  id: string;
  cliente: string;
  itens: Item[];
}

export interface CotacaoItem {
  sku: string;
  precoUnit: number;
  disponivel: boolean;
  prazoDias?: number;
}

export interface CotacaoPlataforma {
  plataforma: 'WebA' | 'WebB' | 'Desktop';
  moeda: 'BRL' | 'USD';
  geradaEm: string; // ISO
  itens: CotacaoItem[];
  total: number;
  observacoes?: string;
  erro?: string;
}

export interface RelatorioConsolidado {
  pedidoId: string;
  cliente: string;
  cotacoes: CotacaoPlataforma[];
  melhorPorItem: Array<{
    sku: string;
    plataforma: CotacaoPlataforma['plataforma'];
    precoUnit: number;
  }>;
  totalMelhorCenario: number;
  geradoEm: string;
}
