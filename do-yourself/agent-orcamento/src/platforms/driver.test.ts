import { describe, it, expect } from 'vitest';
import { parseDropdownOptions, parseBRL } from './driver-helpers.js';

describe('parseBRL', () => {
  it('parses Brazilian currency', () => {
    expect(parseBRL('R$ 2.500,00')).toBe(2500);
    expect(parseBRL('1.234,56')).toBeCloseTo(1234.56);
    expect(parseBRL('R$ 0,00')).toBe(0);
  });
});

describe('parseDropdownOptions', () => {
  it('extracts code + name from "CODE - NAME" option labels', () => {
    const opts = parseDropdownOptions([
      '303535001 - BRILHO RAP S/SIL MOTHERS 473ML',
      '303535004 - CAL.GOLD SYNTHETIC WAX',
    ]);
    expect(opts).toEqual([
      { code: '303535001', name: 'BRILHO RAP S/SIL MOTHERS 473ML' },
      { code: '303535004', name: 'CAL.GOLD SYNTHETIC WAX' },
    ]);
  });
  it('keeps the raw label as name when there is no " - " separator', () => {
    expect(parseDropdownOptions(['MISC ITEM'])).toEqual([{ code: '', name: 'MISC ITEM' }]);
  });
});
