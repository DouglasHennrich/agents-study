import type { Charter } from '../charter/charter.js';
import type { Tool } from '../tools/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { builtinTools } from '../tools/builtin.js';

/**
 * CastingEngine: dado um Charter, monta um "agent pronto" com:
 *  - system prompt
 *  - ToolRegistry filtrado pelas tools permitidas
 *  - registro persistente (memória — Phase 7 troca por StorageProvider)
 *
 * Inspirado (em forma simplificada) em
 * `packages/squad-sdk/src/casting/`.
 */

export interface CastedAgent {
  charter: Charter;
  systemPrompt: string;
  registry: ToolRegistry;
}

export class CastingEngine {
  private cast = new Map<string, CastedAgent>();
  private allTools = new Map<string, Tool>();

  constructor(extraTools: Tool[] = []) {
    [...builtinTools, ...extraTools].forEach((t) =>
      this.allTools.set(t.name, t),
    );
  }

  registerTool(tool: Tool): void {
    this.allTools.set(tool.name, tool);
  }

  castAgent(charter: Charter): CastedAgent {
    const registry = new ToolRegistry();
    const allowed = charter.tools ?? [...this.allTools.keys()];
    for (const name of allowed) {
      const t = this.allTools.get(name);
      if (!t) throw new Error(`Tool não disponível: ${name}`);
      registry.register(t);
    }

    const systemPrompt = renderSystemPrompt(charter);
    const casted: CastedAgent = { charter, systemPrompt, registry };
    this.cast.set(charter.name, casted);
    return casted;
  }

  get(name: string): CastedAgent | undefined {
    return this.cast.get(name);
  }

  list(): CastedAgent[] {
    return [...this.cast.values()];
  }
}

function renderSystemPrompt(c: Charter): string {
  const parts = [
    `# Identidade\nVocê é ${c.name}, ${c.role}.`,
    c.persona && `# Persona\n${c.persona}`,
    c.goals?.length && `# Objetivos\n- ${c.goals.join('\n- ')}`,
    c.constraints?.length && `# Restrições\n- ${c.constraints.join('\n- ')}`,
    '# Formato\nResponda em PT-BR. Seja direto. Use as tools quando precisar de dados externos.',
  ].filter(Boolean) as string[];
  return parts.join('\n\n');
}
