/**
 * Charter: identidade declarativa de um agent. Vira o `system prompt` na
 * inicialização da sessão.
 *
 * Inspirado em `packages/squad-sdk/src/charter/`.
 */

export interface Charter {
  name: string;
  role: string;             // "Coordenador de orçamentos"
  persona?: string;         // estilo, tom
  goals?: string[];
  constraints?: string[];
  tools?: string[];         // nomes das tools permitidas (filtro)
  model?: string;
}

export function charterToSystemPrompt(c: Charter): string {
  const lines = [
    `Você é ${c.name}, ${c.role}.`,
    c.persona ? `Persona: ${c.persona}` : null,
    c.goals?.length ? `Objetivos:\n- ${c.goals.join('\n- ')}` : null,
    c.constraints?.length
      ? `Restrições:\n- ${c.constraints.join('\n- ')}`
      : null,
    c.tools?.length
      ? `Tools disponíveis: ${c.tools.join(', ')}.`
      : null,
    'Responda em PT-BR. Seja conciso.',
  ].filter(Boolean);
  return lines.join('\n\n');
}
