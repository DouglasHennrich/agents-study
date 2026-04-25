/**
 * Router determinístico: aplica regras "se input casar X então use agent Y".
 * Inspirado em `packages/squad-sdk/src/router/`.
 *
 * Regras são tentadas em ordem; a primeira que casa vence. Se nenhuma casar,
 * cai em `defaultAgent`.
 */

export interface RoutingRule {
  /** Regex aplicada ao texto do usuário. Pode ser string ou RegExp. */
  match: string | RegExp;
  agent: string;
  /** Prioridade — maior vence em empate. Padrão 0. */
  priority?: number;
}

export interface CompiledRule {
  re: RegExp;
  agent: string;
  priority: number;
}

export interface RouterConfig {
  rules: RoutingRule[];
  defaultAgent: string;
}

export function compileRoutingRules(rules: RoutingRule[]): CompiledRule[] {
  return rules
    .map<CompiledRule>((r) => ({
      re: r.match instanceof RegExp ? r.match : new RegExp(r.match, 'i'),
      agent: r.agent,
      priority: r.priority ?? 0,
    }))
    .sort((a, b) => b.priority - a.priority);
}

export function matchRoute(
  input: string,
  compiled: CompiledRule[],
  fallback: string,
): string {
  for (const r of compiled) {
    if (r.re.test(input)) return r.agent;
  }
  return fallback;
}

export class Router {
  private compiled: CompiledRule[];
  constructor(private cfg: RouterConfig) {
    this.compiled = compileRoutingRules(cfg.rules);
  }

  route(input: string): string {
    return matchRoute(input, this.compiled, this.cfg.defaultAgent);
  }
}
