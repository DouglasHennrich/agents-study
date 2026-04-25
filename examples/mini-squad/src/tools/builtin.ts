import { z } from 'zod';
import type { Tool } from './types.js';

/**
 * 5 tools "built-in" inspiradas nas que o Squad expõe em
 * `packages/squad-sdk/src/tools/`:
 *
 *  - squad_route   : delega para outro agent
 *  - squad_decide  : registra uma decisão
 *  - squad_memory  : grava/lê notas persistentes
 *  - squad_status  : reporta progresso
 *  - squad_skill   : invoca um "skill" (workflow nomeado)
 *
 * Reimplementadas em forma simplificada — não copiamos código do Squad.
 */

export const squadRoute: Tool<
  { to: string; reason: string; payload?: unknown },
  { ok: true; routedTo: string }
> = {
  name: 'squad_route',
  description: 'Delega a execução para outro agent. Use quando o pedido fugir do seu escopo.',
  input: z.object({
    to: z.string().describe('Nome do agent destino'),
    reason: z.string(),
    payload: z.any().optional(),
  }),
  async run({ to }) {
    // A entrega real é feita pelo Router (Phase 5). Aqui só sinalizamos.
    return { ok: true as const, routedTo: to };
  },
};

export const squadDecide: Tool<
  { decision: string; rationale: string },
  { ok: true }
> = {
  name: 'squad_decide',
  description: 'Registra uma decisão tomada pelo agent (auditoria).',
  input: z.object({ decision: z.string(), rationale: z.string() }),
  async run() {
    return { ok: true as const };
  },
};

const memoryStore = new Map<string, unknown>();

export const squadMemory: Tool<
  { op: 'get' | 'set' | 'list'; key?: string; value?: unknown },
  { ok: true; result: unknown }
> = {
  name: 'squad_memory',
  description: 'Memória chave-valor entre turnos. Use op=set/get/list.',
  input: z.object({
    op: z.enum(['get', 'set', 'list']),
    key: z.string().optional(),
    value: z.any().optional(),
  }),
  async run({ op, key, value }) {
    if (op === 'set') {
      memoryStore.set(key!, value);
      return { ok: true as const, result: 'stored' };
    }
    if (op === 'get') return { ok: true as const, result: memoryStore.get(key!) };
    return { ok: true as const, result: [...memoryStore.keys()] };
  },
};

export const squadStatus: Tool<
  { progress: number; note?: string },
  { ok: true }
> = {
  name: 'squad_status',
  description: 'Reporta progresso (0..100) ao orquestrador.',
  input: z.object({ progress: z.number(), note: z.string().optional() }),
  async run() {
    return { ok: true as const };
  },
};

export const squadSkill: Tool<
  { skill: string; args?: Record<string, unknown> },
  { ok: true; skill: string }
> = {
  name: 'squad_skill',
  description: 'Invoca um workflow nomeado ("skill") registrado no orquestrador.',
  input: z.object({
    skill: z.string(),
    args: z.record(z.any()).optional(),
  }),
  async run({ skill }) {
    return { ok: true as const, skill };
  },
};

export const builtinTools: Tool[] = [
  squadRoute,
  squadDecide,
  squadMemory,
  squadStatus,
  squadSkill,
];
