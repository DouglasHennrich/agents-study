import { describe, it, expect, vi } from 'vitest';
import { resolveLine } from './resolver.js';
import type { Prompter } from '../io/prompt.js';
import type { IPortalDriver, ProductOption } from '../platforms/types.js';

function stubDriver(options: ProductOption[]): IPortalDriver {
  return {
    login: vi.fn(),
    startQuote: vi.fn(),
    addLine: vi.fn(),
    readLinePrice: vi.fn(),
    applyDiscount: vi.fn(),
    readOrderTotal: vi.fn(),
    setParcelas: vi.fn(),
    save: vi.fn(),
    searchProducts: vi.fn(async () => ({ status: 'success' as const, summary: '', data: options })),
  };
}

describe('resolveLine', () => {
  it('uses the cache on a hit and converts CX to units', async () => {
    const repo = {
      find: vi.fn(() => ({ productCode: '303535001', productName: 'BRILHO', unitsPerBox: 6,
        platform: 'autoamerica' as const, aliasNorm: 'produto a', aliasRaw: 'Produto A', createdAt: '' })),
      save: vi.fn(),
    };
    const line = { name: 'Produto A', quantity: { value: 4, unit: 'CX' as const } };
    const resolved = await resolveLine(line, {
      platform: 'autoamerica', repo: repo as any, driver: stubDriver([]), prompter: {} as Prompter,
    });
    expect(resolved.productCode).toBe('303535001');
    expect(resolved.siteUnits).toBe(24);   // 4 boxes * 6 units/box
    expect(resolved.boxes).toBe(4);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('on a miss, searches live, asks the user, persists, and converts', async () => {
    const repo = { find: vi.fn(() => undefined), save: vi.fn() };
    const options = [{ code: '303535001', name: 'BRILHO RAP' }];
    const prompter: Prompter = {
      ask: vi.fn(async () => 'brilho'),
      choose: vi.fn(async () => options[0] as ProductOption | null),
      askInt: vi.fn(async () => 6),
    };
    const line = { name: 'Produto A', quantity: { value: 2, unit: 'UN' as const } };
    const resolved = await resolveLine(line, {
      platform: 'autoamerica', repo: repo as any, driver: stubDriver(options), prompter,
    });
    expect(prompter.choose).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'autoamerica', aliasRaw: 'Produto A', productCode: '303535001', unitsPerBox: 6,
    }));
    expect(resolved.siteUnits).toBe(2);     // UN passes through
    expect(resolved.boxes).toBe(1);         // ceil(2/6) = 1
  });

  it('re-searches when the user picks null then chooses', async () => {
    const repo = { find: vi.fn(() => undefined), save: vi.fn() };
    const opts = [{ code: '1', name: 'A' }];
    const choose = vi.fn()
      .mockResolvedValueOnce(null)         // first: none -> re-search
      .mockResolvedValueOnce(opts[0]!);    // second: pick
    const prompter: Prompter = { ask: vi.fn(async () => 'a'), choose, askInt: vi.fn(async () => 3) };
    const resolved = await resolveLine(
      { name: 'Z', quantity: undefined },
      { platform: 'roberlo', repo: repo as any, driver: stubDriver(opts), prompter },
    );
    expect(choose).toHaveBeenCalledTimes(2);
    expect(resolved.siteUnits).toBe(3);     // not informed -> one box (unitsPerBox=3)
  });
});
