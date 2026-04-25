# 02. Loop ReAct e tool-calling

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

**ReAct** (*Reason + Act*) é o padrão dominante para agents. Em cada iteração:

```mermaid
flowchart LR
  T[Thought\n"preciso saber X"] --> A[Action\n"chamar tool Y"]
  A --> O[Observation\n"resultado de Y"]
  O --> T
  T --> F[Final answer]
```

Modelos modernos (OpenAI, Claude, Copilot) implementam isso via **tool calling nativo**: em vez de o LLM "escrever" `Action: ...` em texto livre, ele retorna um JSON estruturado `tool_calls: [{ name, arguments }]`. Você executa, devolve o resultado como `role: "tool"` e segue a conversa.

**Pseudocódigo do loop:**

```ts
while (true) {
  const reply = await llm.chat({ messages, tools });
  if (reply.tool_calls?.length) {
    for (const call of reply.tool_calls) {
      const result = await registry.run(call.name, call.arguments);
      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }
    continue;          // outra iteração
  }
  return reply.content; // sem tool calls = resposta final
}
```

## Como o Squad faz

O `SquadClient` (em `packages/squad-sdk/src/client/`) encapsula o loop e adiciona:

- **Streaming de tokens** (UX em tempo real).
- **Hook pipeline** antes/depois de cada tool call (Phase 8).
- **EventBus** publicando `tool.called`, `tool.completed`, etc. (Phase 9).
- **Limite de iterações** para evitar loops infinitos.

O LLM provider é o **GitHub Copilot SDK** (`@github/copilot-sdk`), autenticado via `gh auth login` ou `COPILOT_TOKEN`.

## Construa o seu

Esqueleto que será implementado nos capítulos 02 e 03:

```ts
async function runAgent(session: AgentSession, userInput: string, opts: { maxIters?: number } = {}) {
  const max = opts.maxIters ?? 10;
  session.messages.push({ role: 'user', content: userInput });

  for (let i = 0; i < max; i++) {
    const reply = await copilot.chat({
      messages: session.messages,
      tools: session.agent.tools.map(t => t.schema),
    });
    session.messages.push(reply);

    if (!reply.tool_calls?.length) return reply.content;

    for (const call of reply.tool_calls) {
      const tool = session.agent.tools.find(t => t.name === call.name)!;
      const result = await tool.run(call.arguments);
      session.messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }
  throw new Error('Limite de iterações atingido');
}
```

## ✓ Validar

Responda mentalmente:

1. Por que o loop precisa de um `maxIters`? *(LLM pode entrar em loop)*
2. O que diferencia uma `assistant message` com `tool_calls` de uma resposta final? *(presença de `tool_calls`)*
3. Em qual `role` vai o resultado de uma tool? *(`tool`)*
