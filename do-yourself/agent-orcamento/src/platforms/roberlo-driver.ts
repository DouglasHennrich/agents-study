import type { IPortalDriver, StartQuoteOpts, DriverResult, ProductOption, ParcelaPlan } from './types.js';
import type { AgentBrowserRunner } from './agent-browser-runner.js';
import { parseBRL } from './driver-helpers.js';

const LOGIN_URL = 'http://52.67.57.130/portal/U_PortalLogin.apw';

// CJ_CONDPAG option values
const PARCELAS_CODE: Record<string, string> = {
  '30/60/90': '032',
  '30/60': '031',
};

// TRANS-FACE TRANSPORTES LTDA - 61683652000243
const TRANSPORTADORA_CODE = '000293';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Result from reading the detalhe modal — which desconto to apply and its value. */
export interface MaxDiscountResult {
  pct: number;
  /** Which Desconto field to fill in the apply modal: 2, 3, or 0 (none). */
  whichDesc: 0 | 2 | 3;
}

export class RoberloDriver implements IPortalDriver {
  private itemCount = 0;
  /** Maps productCode → tabela code (discovered during searchProducts or addLine). */
  private readonly productTabela = new Map<string, string>();
  /** Stores whichDesc per product for use in applyDiscount after readMaxDiscount. */
  private readonly pendingDiscount = new Map<string, MaxDiscountResult>();

  constructor(
    private readonly runner: AgentBrowserRunner,
    private readonly user: string,
    private readonly pass: string,
  ) {}

  private async evalRaw(js: string): Promise<string> {
    const result = await this.runner(['eval', js]);
    if (result.code !== 0) throw new Error(`eval failed: ${result.stderr.trim()}`);
    return result.stdout.trim();
  }

  private async evalJson<T>(js: string): Promise<T> {
    return JSON.parse(await this.evalRaw(js)) as T;
  }

  private async navigate(url: string): Promise<void> {
    const result = await this.runner(['navigate', url]);
    if (result.code !== 0) throw new Error(`navigate failed: ${result.stderr.trim()}`);
  }

  private async waitLoad(): Promise<void> {
    await this.runner(['wait', '--load', 'networkidle']);
  }

  private async waitFor(conditionJs: string, maxMs = 3000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const ok = await this.evalRaw(`String(!!(${conditionJs}))`);
      if (ok === 'true') return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }

  async login(): Promise<DriverResult> {
    await this.navigate(LOGIN_URL);
    await this.waitLoad();

    await this.evalRaw(`
      var txts = document.querySelectorAll('input[type="text"],input:not([type])');
      var pwds = document.querySelectorAll('input[type="password"]');
      if (txts[0]) txts[0].value = ${JSON.stringify(this.user)};
      if (pwds[0]) pwds[0].value = ${JSON.stringify(this.pass)};
      var btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Acessar') || document.querySelector('button');
      if (btn) btn.click();
      'clicked'
    `);
    await this.waitLoad();

    return { status: 'success', summary: 'Login realizado no Roberlo' };
  }

  async startQuote(opts: StartQuoteOpts): Promise<DriverResult> {
    // Navigate via JS click to preserve session (direct URL navigation loses session token)
    await this.evalRaw(
      `Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Orçamento de Venda'))?.click(); 'ok'`,
    );
    await this.waitLoad();

    // Click "Novo Orçamento"
    await this.evalRaw(
      `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Novo Orç'))?.click(); 'ok'`,
    );
    await this.waitLoad();

    // Find client option by CNPJ/name
    const clientValue = await this.evalRaw(`
      var term = ${JSON.stringify(opts.client)};
      var opt = Array.from(document.getElementById('CJ_CLIENTE').options)
        .find(o => o.text.includes(term));
      opt ? opt.value : ''
    `);

    if (!clientValue) {
      return { status: 'error', summary: `Cliente não encontrado: ${opts.client}` };
    }

    // Set header fields
    await this.evalRaw(`
      jQuery('#CJ_CLIENTE').val(${JSON.stringify(clientValue)}).trigger('change');
      jQuery('#CJ_XTPORC').val('2').trigger('change');         // Previsto
      jQuery('#CJ_TPFRETE').val('C').trigger('change');         // CIF
      jQuery('#CJ_XTRANSP').val(${JSON.stringify(TRANSPORTADORA_CODE)}).trigger('change');
      'done'
    `);

    this.itemCount = 0;
    this.productTabela.clear();
    this.pendingDiscount.clear();
    return { status: 'success', summary: `Orçamento iniciado para ${opts.client}` };
  }

  /** Selects the first non-empty tabela for the given item, loads product options. */
  private async selectFirstTabela(n: string): Promise<string> {
    const tabelaCode = await this.evalRaw(`
      var opt = Array.from(document.getElementById('CK_XTABELA${n}').options)
        .find(o => o.value);
      opt ? opt.value : ''
    `);
    if (tabelaCode) {
      await this.evalRaw(`jQuery('#CK_XTABELA${n}').val(${JSON.stringify(tabelaCode)}).trigger('change'); 'done'`);
      await new Promise(r => setTimeout(r, 300)); // wait for product options to load
    }
    return tabelaCode;
  }

  /** Finds which tabela contains the given product code for item NN. */
  private async findTabela(n: string, productCode: string): Promise<string> {
    const tabelaOptions = await this.evalJson<Array<{ value: string }>>(`
      JSON.stringify(Array.from(document.getElementById('CK_XTABELA${n}').options)
        .filter(o => o.value)
        .map(o => ({value: o.value})))
    `);

    for (const { value: tabelaCode } of tabelaOptions) {
      await this.evalRaw(`jQuery('#CK_XTABELA${n}').val(${JSON.stringify(tabelaCode)}).trigger('change'); 'done'`);
      await new Promise(r => setTimeout(r, 300));
      const found = await this.evalRaw(
        `!!Array.from(document.getElementById('CK_PRODUTO${n}').options).find(o => o.value === ${JSON.stringify(productCode)})`,
      );
      if (found === 'true') return tabelaCode;
    }
    return '';
  }

  async searchProducts(terms: string): Promise<DriverResult<ProductOption[]>> {
    // Ensure item 01 has a tabela selected so products are loaded
    const n = '01';
    const currentTabela = await this.evalRaw(`document.getElementById('CK_XTABELA${n}')?.value || ''`);
    if (!currentTabela) {
      await this.selectFirstTabela(n);
    }

    // Search across all tabela options to gather all matching products
    const tabelaOptions = await this.evalJson<Array<{ value: string }>>(`
      JSON.stringify(Array.from(document.getElementById('CK_XTABELA${n}').options)
        .filter(o => o.value).map(o => ({value: o.value})))
    `);

    const allResults = new Map<string, ProductOption>();
    const lowerTerms = terms.toLowerCase();

    for (const { value: tabelaCode } of tabelaOptions) {
      await this.evalRaw(`jQuery('#CK_XTABELA${n}').val(${JSON.stringify(tabelaCode)}).trigger('change'); 'done'`);
      await new Promise(r => setTimeout(r, 300));

      const opts = await this.evalJson<ProductOption[]>(`
        JSON.stringify(
          Array.from(document.getElementById('CK_PRODUTO${n}').options)
            .filter(o => o.value && o.text.toLowerCase().includes(${JSON.stringify(lowerTerms)}))
            .slice(0, 20)
            .map(o => ({code: o.value, name: o.text}))
        )
      `);

      for (const opt of opts) {
        if (!allResults.has(opt.code)) {
          allResults.set(opt.code, opt);
          this.productTabela.set(opt.code, tabelaCode);
        }
      }
    }

    const data = Array.from(allResults.values()).slice(0, 20);
    if (data.length === 0) {
      return { status: 'warning', summary: `Nenhum produto encontrado para: "${terms}"`, data: [] };
    }
    return { status: 'success', summary: `${data.length} produto(s) encontrado(s)`, data };
  }

  async addLine(productCode: string, units: number): Promise<DriverResult> {
    this.itemCount += 1;
    const n = pad(this.itemCount);

    if (this.itemCount > 1) {
      await this.evalRaw(`document.getElementById('btAddItm').click(); 'clicked'`);
      const appeared = await this.waitFor(`document.getElementById('CK_XTABELA${n}')`);
      if (!appeared) {
        this.itemCount -= 1;
        return { status: 'error', summary: `Linha ${n} não apareceu após clicar em Novo Item` };
      }
    }

    // Select the right tabela for this product
    let tabelaCode = this.productTabela.get(productCode) ?? '';
    if (!tabelaCode) {
      tabelaCode = await this.findTabela(n, productCode);
    } else {
      await this.evalRaw(`jQuery('#CK_XTABELA${n}').val(${JSON.stringify(tabelaCode)}).trigger('change'); 'done'`);
      await new Promise(r => setTimeout(r, 300));
    }

    if (!tabelaCode) {
      this.itemCount -= 1;
      return { status: 'error', summary: `Tabela não encontrada para produto ${productCode}` };
    }

    // Set product
    await this.evalRaw(`jQuery('#CK_PRODUTO${n}').val(${JSON.stringify(productCode)}).trigger('change'); 'done'`);

    // Set quantity (field is disabled — must enable first)
    await this.evalRaw(`
      var q = document.getElementById('CK_QTDVEN${n}');
      q.removeAttribute('disabled');
      q.value = ${JSON.stringify(String(units))};
      q.dispatchEvent(new Event('change', {bubbles:true}));
      q.dispatchEvent(new KeyboardEvent('keyup', {bubbles:true}));
      'done'
    `);

    return { status: 'success', summary: `Item ${n}: produto ${productCode} × ${units} un` };
  }

  async readLinePrice(productCode: string): Promise<DriverResult<{ unit: number; total: number }>> {
    const raw = await this.evalRaw(`
      var n = null;
      for (var i = 1; i <= ${this.itemCount}; i++) {
        var nn = String(i).padStart(2,'0');
        if (document.getElementById('CK_PRODUTO'+nn)?.value === ${JSON.stringify(productCode)}) { n = nn; break; }
      }
      n
        ? JSON.stringify({unit: document.getElementById('CK_XPRCIMP'+n)?.value||'0', total: document.getElementById('CK_VALOR'+n)?.value||'0'})
        : 'null'
    `);

    if (raw === 'null') {
      return { status: 'error', summary: `Produto ${productCode} não encontrado nas linhas` };
    }

    const { unit, total } = JSON.parse(raw) as { unit: string; total: string };
    return {
      status: 'success',
      summary: `Preços lidos: unit=${unit} total=${total}`,
      data: { unit: parseBRL(unit), total: parseBRL(total) },
    };
  }

  /**
   * Reads the maximum available discount for a product from the portal's detalhe modal.
   * Roberlo-specific — accessed via duck-typing in the orchestrator.
   * Priority: Desconto 02 → Desconto 03 → 0 (none).
   */
  async readMaxDiscount(productCode: string): Promise<MaxDiscountResult> {
    const n = await this.evalRaw(`
      var n = null;
      for (var i = 1; i <= ${this.itemCount}; i++) {
        var nn = String(i).padStart(2,'0');
        if (document.getElementById('CK_PRODUTO'+nn)?.value === ${JSON.stringify(productCode)}) { n = nn; break; }
      }
      n || ''
    `);

    if (!n) return { pct: 0, whichDesc: 0 };

    // Open detalhe modal
    await this.evalRaw(`detalheOrc('${n}'); 'ok'`);
    await new Promise(r => setTimeout(r, 400));

    const discounts = await this.evalJson<Record<string, string>>(`
      var modal = document.querySelector('.modal.in');
      var result = {};
      if (modal) {
        Array.from(modal.querySelectorAll('label.control-label')).forEach(lbl => {
          var inp = lbl.closest('.col-lg-3')?.querySelector('input');
          if (inp) result[lbl.textContent.trim()] = inp.value;
        });
      }
      JSON.stringify(result)
    `);

    // Close modal
    await this.evalRaw(`document.querySelector('.modal.in .bootbox-close-button')?.click(); 'closed'`);

    const desc2 = parseFloat(discounts['% Desconto 2'] ?? '0');
    const desc3 = parseFloat(discounts['% Desconto 3'] ?? '0');

    let result: MaxDiscountResult;
    if (desc2 > 0) {
      result = { pct: desc2, whichDesc: 2 };
    } else if (desc3 > 0) {
      result = { pct: desc3, whichDesc: 3 };
    } else {
      result = { pct: 0, whichDesc: 0 };
    }

    this.pendingDiscount.set(productCode, result);
    return result;
  }

  async applyDiscount(productCode: string, pct: number): Promise<DriverResult> {
    const n = await this.evalRaw(`
      var n = null;
      for (var i = 1; i <= ${this.itemCount}; i++) {
        var nn = String(i).padStart(2,'0');
        if (document.getElementById('CK_PRODUTO'+nn)?.value === ${JSON.stringify(productCode)}) { n = nn; break; }
      }
      n || ''
    `);

    if (!n) return { status: 'error', summary: `Produto ${productCode} não encontrado` };

    const pending = this.pendingDiscount.get(productCode);
    const whichDesc = pending?.whichDesc ?? 2;

    // Open apply discount modal
    await this.evalRaw(`descPolimento('${n}'); 'ok'`);
    await new Promise(r => setTimeout(r, 400));

    // Portal expects integer "basis points × 100": 15% → "1500", which it formats to "15,00%"
    const pctStr = String(Math.round(pct * 100));

    if (whichDesc === 3) {
      // iCK_XDESC03 may be disabled via JS property (not only HTML attribute) — clear both
      await this.evalRaw(`
        var d3 = document.getElementById('iCK_XDESC03${n}');
        if (d3) {
          d3.removeAttribute('disabled');
          d3.disabled = false;
          d3.removeAttribute('readonly');
          d3.value = ${JSON.stringify(pctStr)};
          d3.dispatchEvent(new Event('input', {bubbles:true}));
          d3.dispatchEvent(new Event('change', {bubbles:true}));
        }
        vldDesc('${n}');
        'done'
      `);
    } else {
      // Desconto 02 field is enabled by default
      await this.evalRaw(`
        var d2 = document.getElementById('iCK_XDESC02${n}');
        if (d2) {
          d2.value = ${JSON.stringify(pctStr)};
          d2.dispatchEvent(new Event('input', {bubbles:true}));
          d2.dispatchEvent(new Event('change', {bubbles:true}));
        }
        vldDesc('${n}');
        'done'
      `);
    }

    // Click OK
    await this.evalRaw(`document.querySelector('.modal.in button[data-bb-handler="sucess"]')?.click(); 'ok'`);
    await new Promise(r => setTimeout(r, 300));

    this.pendingDiscount.delete(productCode);
    return { status: 'success', summary: `Desconto ${pct}% aplicado em ${productCode} (Desc0${whichDesc})` };
  }

  async readOrderTotal(): Promise<DriverResult<number>> {
    const raw = await this.evalRaw(`document.getElementById('TOTAL_ORC')?.value || '0'`);
    return { status: 'success', summary: `Total do pedido: ${raw}`, data: parseBRL(raw) };
  }

  async setParcelas(plan: ParcelaPlan): Promise<DriverResult> {
    const code = PARCELAS_CODE[plan.label];
    if (!code) {
      return { status: 'error', summary: `Condição de pagamento não mapeada: "${plan.label}"` };
    }
    await this.evalRaw(`jQuery('#CJ_CONDPAG').val(${JSON.stringify(code)}).trigger('change'); 'done'`);
    return { status: 'success', summary: `Parcelas: ${plan.label} (código ${code})` };
  }

  async save(): Promise<DriverResult> {
    await this.evalRaw(`document.getElementById('btSalvar').click(); 'clicked'`);
    await this.waitLoad();
    return { status: 'success', summary: 'Orçamento Roberlo salvo com sucesso' };
  }
}
