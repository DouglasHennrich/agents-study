// Compaction strategies (s06)
import type { Message, ContentBlock, LlmProvider } from '../provider/types.js';

export interface CompactStrategy {
  name: string;
  shouldRun(messages: Message[], approxTokens: number): boolean;
  apply(messages: Message[]): Promise<Message[]>;
}

export function estimateTokens(msgs: Message[]): number {
  return Math.floor(JSON.stringify(msgs).length / 4);
}

export class SnipCompactStrategy implements CompactStrategy {
  name = 'snip';
  shouldRun(messages: Message[]): boolean { return messages.length > 20; }
  async apply(messages: Message[]): Promise<Message[]> {
    return messages.filter((m) => {
      if (typeof m.content === 'string') return m.content.trim().length > 0;
      if (Array.isArray(m.content)) {
        if (m.content.length === 0) return false;
        const orphan = m.content.some((b: ContentBlock) => b.type === 'tool_result' && !b.tool_use_id);
        if (orphan) return false;
      }
      return true;
    });
  }
}

export class CollapseStrategy implements CompactStrategy {
  name = 'collapse';
  shouldRun(messages: Message[]): boolean {
    return messages.some((m) => Array.isArray(m.content) && m.content.length > 1);
  }
  async apply(messages: Message[]): Promise<Message[]> {
    return messages.map((m) => {
      if (!Array.isArray(m.content)) return m;
      const collapsed: ContentBlock[] = [];
      for (const block of m.content) {
        const last = collapsed[collapsed.length - 1];
        if (block.type === 'text' && last?.type === 'text') {
          last.text = `${last.text}\n${block.text}`;
        } else {
          collapsed.push(block);
        }
      }
      return { ...m, content: collapsed };
    });
  }
}

export class AutoCompactStrategy implements CompactStrategy {
  name = 'auto';
  constructor(private provider: LlmProvider, private threshold = 50_000) {}
  shouldRun(_msgs: Message[], approx: number): boolean { return approx > this.threshold; }
  async apply(messages: Message[]): Promise<Message[]> {
    if (messages.length < 6) return messages;
    const cutoff = Math.floor(messages.length / 2);
    const old = messages.slice(0, cutoff);
    const recent = messages.slice(cutoff);

    let summary = '';
    for await (const evt of this.provider.stream({
      system: 'Resuma a conversa abaixo em até 500 palavras, preservando decisões e fatos importantes.',
      messages: [{ role: 'user', content: JSON.stringify(old).slice(0, 50_000) }],
      tools: [],
      max_tokens: 1000,
    })) {
      if (evt.type === 'content_block_delta' && evt.delta.type === 'text_delta' && evt.delta.text) {
        summary += evt.delta.text;
      }
    }

    return [
      { role: 'user', content: `[compact summary]\n${summary}\n[/compact summary]` },
      { role: 'assistant', content: 'Entendido, continuemos.' },
      ...recent,
    ];
  }
}
