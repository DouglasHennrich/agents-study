/**
 * Tipos comuns de mensagens e tools — espelham (em forma simplificada)
 * o protocolo OpenAI Chat Completions usado pelo @github/copilot-sdk.
 */

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface Message {
  role: Role;
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ChatRequest {
  messages: Message[];
  tools?: ToolSchema[];
  model?: string;
  stream?: boolean;
}

export interface ChatResponse {
  message: Message;        // assistant message (pode ter tool_calls)
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface StreamChunk {
  delta: string;             // pedaço de texto
  toolCallDelta?: Partial<ToolCall>;
  finishReason?: ChatResponse['finishReason'];
}
