import picomatch from 'picomatch';
import type { Hook, HookDecision } from './pipeline.js';

/**
 * Bloqueia escrita de arquivos fora de uma allowlist (glob picomatch).
 * Reage a tools cujo `name` esteja em `writeToolNames` e cujo argumento
 * `path` esteja fora dos patterns permitidos.
 */
export function fileWriteGuard(opts: {
  allow: string[];
  writeToolNames?: string[];
}): Hook {
  const writeNames = new Set(opts.writeToolNames ?? ['fs_write', 'write_file']);
  const isAllowed = picomatch(opts.allow);

  return {
    kind: 'before_tool',
    name: 'file-write-guard',
    run(p): HookDecision {
      if (p.kind !== 'before_tool') return { type: 'allow' };
      if (!writeNames.has(p.call.name)) return { type: 'allow' };
      const path = (p.call.arguments as any)?.path;
      if (typeof path !== 'string') return { type: 'allow' };
      if (!isAllowed(path)) {
        return { type: 'deny', reason: `path bloqueado: ${path}` };
      }
      return { type: 'allow' };
    },
  };
}

/**
 * Mascara CPF/email/telefone básicos em mensagens enviadas ao LLM
 * e em outputs de tools. Pode ser usado em `before_llm` ou `after_tool`.
 */
export function piiScrubHook(kind: 'before_llm' | 'after_tool' = 'before_llm'): Hook {
  const scrub = (s: string) =>
    s
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]')
      .replace(/\b\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, '[TEL]');

  return {
    kind,
    name: `pii-scrub-${kind}`,
    run(p) {
      if (p.kind === 'before_llm') {
        const messages = p.messages.map((m) =>
          typeof m.content === 'string' ? { ...m, content: scrub(m.content) } : m,
        );
        return { type: 'rewrite', payload: { ...p, messages } };
      }
      if (p.kind === 'after_tool') {
        const output =
          typeof p.output === 'string'
            ? scrub(p.output)
            : JSON.parse(scrub(JSON.stringify(p.output)));
        return { type: 'rewrite', payload: { ...p, output } };
      }
      return { type: 'allow' };
    },
  };
}

/**
 * Rate limit simples por (sessão, tool). Aborta se exceder N chamadas
 * em uma janela.
 */
export function rateLimitHook(opts: {
  limit: number;
  windowMs: number;
}): Hook {
  const counters = new Map<string, number[]>();

  return {
    kind: 'before_tool',
    name: 'rate-limit',
    run(p) {
      if (p.kind !== 'before_tool') return { type: 'allow' };
      const key = `${p.ctx.sessionId}:${p.call.name}`;
      const now = Date.now();
      const arr = (counters.get(key) ?? []).filter(
        (t) => now - t < opts.windowMs,
      );
      arr.push(now);
      counters.set(key, arr);
      if (arr.length > opts.limit) {
        return {
          type: 'deny',
          reason: `rate-limit excedido para ${p.call.name}`,
        };
      }
      return { type: 'allow' };
    },
  };
}

/**
 * Reviewer lockout: trava o agent após N denies consecutivos —
 * exige reset humano.
 *
 * NOTA: a integração completa exige observar `tool.denied` no EventBus
 * e chamar os métodos `onDeny`/`reset` expostos no objeto retornado.
 * Aqui devolvemos um objeto que estende o `Hook` com esses helpers.
 */
export function reviewerLockout(opts: { maxDenies: number }) {
  let denies = 0;
  let locked = false;
  const hook: Hook & { onDeny(): void; reset(): void } = {
    kind: 'before_tool',
    name: 'reviewer-lockout',
    run() {
      if (locked) {
        return { type: 'deny', reason: 'agent travado por reviewer-lockout' };
      }
      return { type: 'allow' };
    },
    onDeny() {
      denies++;
      if (denies >= opts.maxDenies) locked = true;
    },
    reset() {
      denies = 0;
      locked = false;
    },
  };
  return hook;
}
