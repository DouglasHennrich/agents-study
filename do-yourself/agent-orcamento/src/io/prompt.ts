import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { ProductOption } from '../platforms/types.js';

export interface Prompter {
  /** Free-text question; returns the trimmed answer. */
  ask(question: string): Promise<string>;
  /** Pick one option from a list, or return null to re-search. */
  choose(question: string, options: ProductOption[]): Promise<ProductOption | null>;
  /** Ask for a positive integer (e.g. units per box). */
  askInt(question: string): Promise<number>;
}

export function formatOptions(options: ProductOption[]): string {
  return options.map((o, i) => `${i + 1}) ${o.code} - ${o.name}`).join('\n');
}

export class ConsolePrompter implements Prompter {
  async ask(question: string): Promise<string> {
    const rl = readline.createInterface({ input, output });
    try { return (await rl.question(`${question} `)).trim(); }
    finally { rl.close(); }
  }

  async askInt(question: string): Promise<number> {
    for (;;) {
      const raw = await this.ask(question);
      const n = Number(raw);
      if (Number.isInteger(n) && n > 0) return n;
      output.write('Digite um número inteiro positivo.\n');
    }
  }

  async choose(question: string, options: ProductOption[]): Promise<ProductOption | null> {
    output.write(`${question}\n${formatOptions(options)}\n0) Nenhum / buscar de novo\n`);
    for (;;) {
      const raw = await this.ask('Escolha o número:');
      const n = Number(raw);
      if (n === 0) return null;
      if (Number.isInteger(n) && n >= 1 && n <= options.length) {
        const chosen = options[n - 1];
        if (chosen) return chosen;
      }
      output.write('Opção inválida.\n');
    }
  }
}
