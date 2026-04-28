// types.ts
import Anthropic from "@anthropic-ai/sdk";

/**
 * Uma "tool" que o agent pode usar.
 * É basicamente uma função TypeScript com metadados
 * que o LLM usa para saber quando e como chamá-la.
 */
export interface IAgentTool {
  // Identificador único — Claude usa este nome para invocar a tool
  name: string;

  // Explica O QUÊ a tool faz.
  // Quanto melhor a descrição, mais assertivo Claude será na escolha certa.
  description: string;

  // JSON Schema dos parâmetros que a tool aceita
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required: string[];
  };

  // A função que REALMENTE executa quando Claude solicitar
  execute: (input: Record<string, unknown>) => Promise<string>;
}

/**
 * Resultado de uma execução de tool
 */
export interface IToolResult {
  toolUseId: string;  // ID que liga o resultado ao pedido do Claude
  content: string;    // Resultado em string (pode ser JSON serializado)
  isError: boolean;   // Se verdadeiro, Claude saberá que houve erro
}

/**
 * Estado interno do loop do agent
 */
export interface IAgentState {
  messages: Anthropic.MessageParam[];  // Histórico completo da conversa
  iteration: number;                   // Iteração atual
  maxIterations: number;               // Limite de segurança
  finished: boolean;                   // Se o loop deve parar
}