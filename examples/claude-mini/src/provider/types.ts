// Provider-agnostic message + event types (s00)

export type Role = 'user' | 'assistant' | 'system';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface Message {
  role: Role;
  content: string | ContentBlock[];
}

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: object;
}

export interface StreamRequest {
  system: string;
  messages: Message[];
  tools: ToolSpec[];
  max_tokens?: number;
  model?: string;
}

export type StreamEvent =
  | { type: 'message_start' }
  | { type: 'content_block_start'; block: { type: 'text' | 'tool_use'; id?: string; name?: string } }
  | { type: 'content_block_delta'; delta: { type: 'text_delta' | 'input_json_delta'; text?: string; partial_json?: string } }
  | { type: 'content_block_stop' }
  | {
      type: 'message_stop';
      stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
      usage?: { input_tokens: number; output_tokens: number };
      blocks: ContentBlock[];
    };

export interface LlmProvider {
  name: string;
  stream(req: StreamRequest): AsyncIterable<StreamEvent>;
}
