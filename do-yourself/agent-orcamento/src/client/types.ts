/**
 * Tipos comuns de mensagens e tools — espelham (em forma simplificada)
 * o protocolo OpenAI Chat Completions usado pelo @github/copilot-sdk.
 */

export type TRole = 'system' | 'user' | 'assistant' | 'tool';

export interface IToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface IMessage {
  role: TRole;
  content?: string | null;
  tool_calls?: IToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface IToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface IChatRequest {
  messages: IMessage[];
  tools?: IToolSchema[];
  model?: string;
  stream?: boolean;
}

export interface IChatResponse {
  message: IMessage;        // assistant message (pode ter tool_calls)
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface IStreamChunk {
  delta: string;             // pedaço de texto
  toolCallDelta?: Partial<IToolCall>;
  finishReason?: IChatResponse['finishReason'];
}
