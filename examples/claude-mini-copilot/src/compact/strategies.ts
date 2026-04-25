// Compaction strategies (s06) — adaptado para protocolo OpenAI.
//
// Diferenças vs claude-mini:
//   - Snip: detecta órfão como msg role:"tool" sem tool_call_id casando.
//   - Collapse: junta strings de mensagens consecutivas same-role (sem blocos).
//   - AutoCompact: usa system como messages[0].

import type { Message, LlmProvider } from '../provider/types.js';

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
    // Coleta tool_call_ids válidos (declarados em algum assistant.tool_calls).
    const validIds = new Set<string>();
    for (const m of messages) {
      if (m.role === 'assistant' && m.tool_calls) {
        for (const tc of m.tool_calls) validIds.add(tc.id);
      }
    }
    return messages.filter((m) => {
      // tool sem id válido → órfão
      if (m.role === 'tool') {
        if (!m.tool_call_id || !validIds.has(m.tool_call_id)) return false;
        return true;
      }
      // assistant vazio (sem texto E sem tool_calls)
      if (m.role === 'assistant') {
        const empty = (!m.content || (typeof m.content === 'string' && !m.content.trim()))
          && (!m.tool_calls || m.tool_calls.length === 0);
        return !empty;
      }
      // user/system: descarta se string vazia
      if (typeof m.content === 'string' && !m.content.trim()) return false;
      return true;
    });
  }
}

export class CollapseStrategy implements CompactStrategy {
  name = 'collapse';
  shouldRun(messages: Message[]): boolean {
    // Junta msgs consecutivas same-role só de texto.
    for (let i = 1; i < messages.length; i++) {
      const a = messages[i - 1]; const b = messages[i];
      if (a.role === b.role && a.role !== 'tool'
          && typeof a.content === 'string' && typeof b.content === 'string'
          && !a.tool_calls && !b.tool_calls) return true;
    }
    return false;
  }
  async apply(messages: Message[]): Promise<Message[]> {
    const out: Message[] = [];
    for (const m of messages) {
      const last = out[out.length - 1];
      if (last && last.role === m.role && m.role !== 'tool'
          && typeof last.content === 'string' && typeof m.content === 'string'
          && !last.tool_calls && !m.tool_calls) {
        last.content = `${last.content}\n${m.content}`;
      } else {
        out.push({ ...m });
      }
    }
    return out;
  }
}

export class AutoCompactStrategy implements CompactStrategy {
  name = 'auto';
  constructor(private provider: LlmProvider, private threshold = 50_000) {}
  shouldRun(_msgs: Message[], approx: number): boolean { return approx > this.threshold; }
  async apply(messages: Message[]): Promise<Message[]> {
    if (messages.length < 6) return messages;
    // Preserva system inicial se existir.
    const sysIdx = messages[0]?.role === 'system' ? 1 : 0;
    const head = messages.slice(0, sysIdx);
    const body = messages.slice(sysIdx);

    const cutoff = Math.floor(body.length / 2);
    const old = body.slice(0, cutoff);
    const recent = body.slice(cutoff);

    let summary = '';
    for await (const evt of this.provider.stream({
      messages: [
        { role: 'system', content: 'Resuma a conversa abaixo em até 500 palavras, preservando decisões e fatos importantes.' },
        { role: 'user', content: JSON.stringify(old).slice(0, 50_000) },
      ],
      tools: [],
      max_tokens: 1000,
    })) {
      if (evt.type === 'text_delta') summary += evt.text;
    }

    return [
      ...head,
      { role: 'user', content: `[compact summary]\n${summary}\n[/compact summary]` },
      { role: 'assistant', content: 'Entendido, continuemos.' },
      ...recent,
    ];
  }
}
