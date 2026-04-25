import type { Pedido, RelatorioConsolidado } from './domain.js';
import { consolidar } from './consolidacao.js';
import { cotarDesktop, cotarWebA, cotarWebB } from './tools.js';
import type { EventBus } from '../events/event-bus.js';

/**
 * Orquestração determinística do orçamento: dispara as 3 cotações em
 * paralelo (Promise.all) e consolida.
 *
 * Em uma versão "agentica" pura, o Coordinator (LLM) decidiria chamar
 * cada tool — e o loop ReAct cuidaria do resto. Aqui mostramos a versão
 * determinística (sem LLM) para que `mini-squad orcar` funcione mesmo
 * sem token Copilot, e seja totalmente testável.
 *
 * Inspirado em `spawnParallel` patterns do Squad.
 */
export async function orquestrarOrcamento(
  pedido: Pedido,
  bus?: EventBus,
): Promise<RelatorioConsolidado> {
  const ctx = { sessionId: `orc-${pedido.id}`, agentName: 'Coordinator' };
  bus?.emit('agent.started', { sessionId: ctx.sessionId, agentName: ctx.agentName });

  const itens = pedido.itens.map((i) => ({ sku: i.sku, quantidade: i.quantidade }));

  const cotacoes = await Promise.all([
    safeRun('WebA', () => cotarWebA.run({ itens }, ctx)),
    safeRun('WebB', () => cotarWebB.run({ itens }, ctx)),
    safeRun('Desktop', () => cotarDesktop.run({ itens }, ctx)),
  ]);

  bus?.emit('agent.progress', { sessionId: ctx.sessionId, progress: 80, note: 'cotacoes-prontas' });

  const r = consolidar(pedido, cotacoes);
  bus?.emit('agent.completed', {
    sessionId: ctx.sessionId,
    agentName: ctx.agentName,
    result: { total: r.totalMelhorCenario },
  });
  return r;
}

async function safeRun<T extends { plataforma: any }>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    return {
      plataforma: label,
      moeda: 'BRL',
      geradaEm: new Date().toISOString(),
      itens: [],
      total: 0,
      erro: (err as Error).message,
    } as unknown as T;
  }
}
