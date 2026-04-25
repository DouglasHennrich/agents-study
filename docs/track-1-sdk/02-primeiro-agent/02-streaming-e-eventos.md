# 02. Streaming e eventos

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Sem streaming, o usuário espera segundos olhando o cursor. Com streaming, ele vê os tokens chegando — UX dramaticamente melhor, mesmo para a mesma latência total. O Copilot SDK suporta `stream: true` e devolve um async iterable de chunks.

## Como o Squad faz

O `SquadClient` expõe `stream()` que devolve um `AsyncIterable<StreamChunk>`. Cada chunk pode trazer:

- `delta.content` — pedaço de texto.
- `delta.tool_calls` — pedaços de uma tool call (chega fragmentado).
- `finish_reason` — encerramento.

O **EventBus** (Phase 9) republica esses chunks como `agent.token`, `agent.toolCallStarted` etc. — assim a CLI/Ralph monitoram em tempo real sem acoplar.

## Construa o seu

Já implementamos `CopilotProvider.stream()` no capítulo anterior. Vamos consumi-lo:

```ts
// uso direto
const llm = new CopilotProvider();

for await (const chunk of llm.stream({
  messages: [{ role: 'user', content: 'Conte até 5 devagar.' }],
})) {
  if (chunk.delta) process.stdout.write(chunk.delta);
  if (chunk.finishReason) console.log('\n[fim:', chunk.finishReason, ']');
}
```

### Cuidados práticos

- **Tool calls fragmentados**: ao streamar, o `name` chega no primeiro chunk e o `arguments` em pedaços JSON. Você precisa **acumular** antes de invocar. No Squad, isso é responsabilidade do `Runtime`; faremos algo equivalente quando montarmos o loop ReAct (Phase 4–5).
- **Cancelamento**: `for await` + `AbortController` — passe um `signal` ao SDK para abortar streams longos.
- **Backpressure**: como é um iterable, o consumidor naturalmente segura o ritmo.

## ✓ Validar

```bash
cd examples/mini-squad
npx tsx -e "
import { CopilotProvider } from './src/client/index.ts';
const llm = new CopilotProvider();
for await (const c of llm.stream({ messages: [{ role:'user', content:'oi em 1 frase' }] })) {
  if (c.delta) process.stdout.write(c.delta);
}
console.log();
"
# Saída esperada: tokens aparecendo progressivamente (não tudo de uma vez).
```
