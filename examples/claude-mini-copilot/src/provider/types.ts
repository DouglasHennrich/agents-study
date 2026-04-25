// Provider-agnostic types — formato OpenAI Chat Completions (Copilot SDK).

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
  tool_call_id?: string;       // para mensagens role:"tool"
  name?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: object;          // JSON Schema (sem o wrapping {type:'function',function:{...}})
}

export interface StreamRequest {
  messages: Message[];          // system entra como messages[0]
  tools: ToolSpec[];
  model?: string;
  max_tokens?: number;
}

export type StreamEvent =
  | { type: 'message_start' }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_delta'; id: string; name?: string; argumentsPartial?: string }
  | {
      type: 'message_stop';
      finish_reason: 'stop' | 'tool_calls' | 'length' | 'error';
      message: Message;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

export interface LlmProvider {
  name: string;
  stream(req: StreamRequest): AsyncIterable<StreamEvent>;
}
