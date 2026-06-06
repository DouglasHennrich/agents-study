import type { ProductOption } from './types.js';

/** "R$ 2.500,00" -> 2500. Strips currency symbol, dots (thousands), converts comma to dot. */
export function parseBRL(text: string): number {
  const cleaned = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  if (Number.isNaN(n)) throw new Error(`Valor monetário inválido: "${text}"`);
  return n;
}

/** Splits "CODE - NAME" dropdown labels into { code, name }. */
export function parseDropdownOptions(labels: string[]): ProductOption[] {
  return labels.map((raw) => {
    const idx = raw.indexOf(' - ');
    if (idx === -1) return { code: '', name: raw.trim() };
    return { code: raw.slice(0, idx).trim(), name: raw.slice(idx + 3).trim() };
  });
}
