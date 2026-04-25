# s09. Teams — `InProcessTeammate`

> *"Múltiplos agents especializados ≠ múltiplos sub-agents."* Sub-agent é **transitório** (filho que volta resumo). Teammate é **persistente**, com identidade, mailbox, e histórico próprio.

## Como Claude Code faz

📂 `src/tools/TeamCreate/Delete`, `src/tasks/InProcessTeammateTask/`, `src/utils/swarm/`

| Sub-agent (s04) | Teammate (s09) |
|---|---|
| Vive 1 chamada | Vive a sessão inteira (ou mais) |
| Sem identidade | Tem `name`, `role`, `tools[]`, persona |
| Comunicação síncrona (return) | Comunicação assíncrona (mailbox) |
| Pai bloqueia esperando | Pai segue, lê inbox quando quiser |

## Versão didática

📄 `src/teams/teammate.ts`

```ts
import { runQuery } from '../query.js';
import type { LlmProvider, Message } from '../provider/types.js';
import type { ToolRegistry } from '../tools/registry.js';

export interface Teammate {
  id: string;
  name: string;
  role: string;
  inbox: Message[];
  outbox: Message[];
  history: Message[];
  systemPrompt: string;
  tools: ToolRegistry;
  busy: boolean;
}

const teammates = new Map<string, Teammate>();

export function createTeammate(input: {
  name: string; role: string; systemPrompt: string; tools: ToolRegistry;
}): Teammate {
  const id = `tm_${Math.random().toString(36).slice(2, 10)}`;
  const tm: Teammate = {
    id, name: input.name, role: input.role,
    systemPrompt: input.systemPrompt,
    tools: input.tools,
    inbox: [], outbox: [], history: [],
    busy: false,
  };
  teammates.set(id, tm);
  return tm;
}

export function getTeammate(id: string): Teammate | undefined { return teammates.get(id); }
export function listTeammates(): Teammate[] { return [...teammates.values()]; }
export function deleteTeammate(id: string): boolean { return teammates.delete(id); }

export function deliver(toId: string, msg: Message) {
  const tm = teammates.get(toId);
  if (!tm) throw new Error(`teammate ${toId} não existe`);
  tm.inbox.push(msg);
}

export async function tickTeammate(id: string, provider: LlmProvider) {
  const tm = teammates.get(id);
  if (!tm || tm.busy || tm.inbox.length === 0) return;
  tm.busy = true;

  const newMsgs = tm.inbox.splice(0, tm.inbox.length);
  tm.history.push(...newMsgs);

  let response = '';
  for await (const evt of runQuery({
    provider,
    prompt: '',                    // history já contém tudo
    systemPrompt: tm.systemPrompt,
    tools: tm.tools,
    messages: tm.history,          // se runQuery aceitar; senão use prompt
    maxTurns: 5,
  } as any)) {
    if (evt.type === 'text' && evt.text) response += evt.text;
  }

  const out: Message = { role: 'assistant', content: response };
  tm.history.push(out);
  tm.outbox.push(out);
  tm.busy = false;
}
```

## Tools

📄 `src/tools/builtin/team.ts`

```ts
import { z } from 'zod';
import { buildTool } from '../registry.js';
import { createTeammate, listTeammates, deleteTeammate, deliver, getTeammate } from '../../teams/teammate.js';
import { ToolRegistry } from '../registry.js';
import { fileReadTool } from './file-read.js';

export const teamCreateTool = buildTool({
  name: 'team_create',
  description: 'Cria um teammate persistente com role específico (ex.: "reviewer", "tester").',
  schema: z.object({
    name: z.string(),
    role: z.string(),
    system_prompt: z.string(),
  }),
  async call({ name, role, system_prompt }) {
    const tools = new ToolRegistry().register(fileReadTool);
    const tm = createTeammate({ name, role, systemPrompt: system_prompt, tools });
    return { id: tm.id, name: tm.name, role: tm.role };
  },
});

export const teamListTool = buildTool({
  name: 'team_list',
  description: 'Lista teammates ativos.',
  schema: z.object({}),
  isReadOnly: true,
  async call() {
    return listTeammates().map(t => ({
      id: t.id, name: t.name, role: t.role, inbox: t.inbox.length, busy: t.busy,
    }));
  },
});

export const teamDeleteTool = buildTool({
  name: 'team_delete',
  description: 'Remove teammate.',
  schema: z.object({ id: z.string() }),
  isDestructive: true,
  async call({ id }) { return { deleted: deleteTeammate(id) }; },
});

export const teamInboxTool = buildTool({
  name: 'team_read_outbox',
  description: 'Lê mensagens que um teammate produziu (e ainda não foram lidas).',
  schema: z.object({ id: z.string() }),
  isReadOnly: true,
  async call({ id }) {
    const tm = getTeammate(id);
    if (!tm) return { error: 'not found' };
    const msgs = tm.outbox.splice(0, tm.outbox.length);
    return { messages: msgs };
  },
});
```

## Quando usar Team vs Sub-agent

| Cenário | Use |
|---|---|
| "Pesquise X uma vez" | sub-agent (s04) |
| "Acompanhe um arquivo durante a sessão" | teammate |
| "Reviewer que comenta cada commit" | teammate (recebe diff por mensagem) |
| "Resumo de uma pasta" | sub-agent |

## Anti-padrões

- ❌ Criar teammate pra coisa de 1 turno.
- ❌ Teammate sem `role` claro (modelo confunde quando despachar).
- ❌ Inbox sem limite → memory leak.
- ❌ Usar `team_*` quando `spawn_agent` resolve.

## ✓ Validar

```bash
npm run dev -- chat "Crie um teammate 'reviewer' especializado em revisar TS. Mande pra ele revisar src/query.ts. Leia a resposta."
```

## Próximo

→ [s10. Team Protocols — `SendMessage`](s10-team-protocols.md)
