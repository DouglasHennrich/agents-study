import type { LlmProvider } from '../client/copilot-provider.js';
import type { CastedAgent } from '../casting/casting-engine.js';
import type { AgentSession, SessionPool } from '../session/session.js';
import type { HookPipeline } from '../hooks/pipeline.js';
import type { EventBus } from '../events/event-bus.js';
import type { Message } from '../client/types.js';
import type { ToolContext } from '../tools/types.js';

export interface RuntimeOptions {
  llm: LlmProvider;
  pool: SessionPool;
  hooks?: HookPipeline;
  bus?: EventBus;
  maxIters?: number;
}

/**
 * Runtime que executa o loop ReAct de um agent até a resposta final.
 *
 * Inspirado em `packages/squad-sdk/src/client/` (SquadClient.run).
 */
export class Runtime {
  constructor(private opts: RuntimeOptions) {}

  async run(
    agent: CastedAgent,
    session: AgentSession,
    userInput: string,
  ): Promise<string> {
    const { llm, pool, hooks, bus } = this.opts;
    const max = this.opts.maxIters ?? 8;

    bus?.emit('agent.started', {
      sessionId: session.id,
      agentName: agent.charter.name,
    });

    await pool.appendMessages(session.id, [
      { role: 'user', content: userInput },
    ]);
    await pool.update(session.id, { status: 'running' });

    try {
      for (let i = 0; i < max; i++) {
        let messages = session.messages;
        if (hooks) {
          const d = await hooks.dispatch({
            kind: 'before_llm',
            messages,
            ctx: { sessionId: session.id, agentName: agent.charter.name },
          });
          if (d.type === 'rewrite' && d.payload.kind === 'before_llm') {
            messages = d.payload.messages;
          }
        }

        const reply = await llm.chat({
          messages,
          tools: agent.registry.schemas(),
          model: agent.charter.model,
        });

        await pool.appendMessages(session.id, [reply.message]);

        if (!reply.message.tool_calls?.length) {
          await pool.update(session.id, { status: 'done' });
          bus?.emit('agent.completed', {
            sessionId: session.id,
            agentName: agent.charter.name,
            result: reply.message.content,
          });
          return reply.message.content ?? '';
        }

        const toolMessages: Message[] = [];
        for (const call of reply.message.tool_calls) {
          const ctx: ToolContext = {
            sessionId: session.id,
            agentName: agent.charter.name,
          };
          bus?.emit('tool.called', {
            sessionId: session.id,
            tool: call.name,
            args: call.arguments,
          });

          if (hooks) {
            const d = await hooks.dispatch({ kind: 'before_tool', call, ctx });
            if (d.type === 'deny') {
              bus?.emit('tool.denied', {
                sessionId: session.id,
                tool: call.name,
                reason: d.reason,
              });
              toolMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify({ ok: false, error: d.reason }),
              });
              continue;
            }
          }

          const result = await agent.registry.run(call.name, call.arguments, ctx);
          let output: unknown = result;

          if (hooks) {
            const d = await hooks.dispatch({
              kind: 'after_tool',
              call,
              ctx,
              output,
            });
            if (d.type === 'rewrite' && d.payload.kind === 'after_tool') {
              output = d.payload.output;
            }
          }

          bus?.emit('tool.completed', {
            sessionId: session.id,
            tool: call.name,
            output,
          });
          toolMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(output),
          });
        }

        await pool.appendMessages(session.id, toolMessages);
      }

      throw new Error('Limite de iterações atingido');
    } catch (err) {
      const error = (err as Error).message;
      await pool.update(session.id, { status: 'error' });
      bus?.emit('agent.error', {
        sessionId: session.id,
        agentName: agent.charter.name,
        error,
      });
      throw err;
    }
  }
}
