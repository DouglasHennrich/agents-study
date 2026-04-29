# 01. Chamando o Copilot SDK

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Antes de qualquer "agent", precisamos saber **chamar o LLM** e receber uma resposta. O contrato é o de **Chat Completions**: enviamos uma lista de mensagens (`system`, `user`, `assistant`, `tool`) e recebemos a próxima `assistant message`.

## Como o Squad faz

O Squad encapsula tudo em `SquadClient` (`packages/squad-sdk/src/client/`). Ele:

1. Resolve credenciais (`COPILOT_TOKEN` ou `gh auth token`).
2. Cria o cliente do Copilot SDK uma única vez (lazy).
3. Expõe um método `chat({ messages, tools, model })` simples.

Por baixo, o SDK v0.3+ usa sessões JSON-RPC: `createSession()` inicia a sessão e `sendAndWait()` envia a mensagem e aguarda a resposta via evento `assistant.message`.

## Construa o seu

Crie `src/client/types.ts` (espelha o protocolo OpenAI), `src/client/copilot-provider.ts` (wrapper) e `src/client/index.ts` (barrel).

> Os arquivos já estão no repo: [`src/client/types.ts`](../../examples/mini-squad/src/client/types.ts), [`src/client/copilot-provider.ts`](../../examples/mini-squad/src/client/copilot-provider.ts).

Pontos-chave do `CopilotProvider` (SDK v0.3+):

- **`CopilotClient`** instanciado com `gitHubToken` — autenticação direta sem import dinâmico.
- **Sessão por chamada**: `createSession()` + `sendAndWait()` retorna `AssistantMessageEvent` com `event.data.content`.
- **Sistema de mensagens**: mensagens `system` são passadas via `systemMessage: { mode: 'replace', content }` no `createSession()`; mensagens `user` anteriores são repassadas via `sendAndWait()` para manter contexto multi-turn.
- **Tool calls**: o SDK v0.3+ executa o loop ReAct internamente — `chat()` retorna a resposta final após o SDK ter resolvido eventuais tool calls.

### Exemplo de uso (manual, sem agent ainda)

```ts
// src/examples/hello-copilot.ts (criado para teste local)
import { CopilotProvider } from '../client/index.js';

const llm = new CopilotProvider({ model: 'gpt-4o-mini' });

const res = await llm.chat({
  messages: [
    { role: 'system', content: 'Você é um assistente conciso em PT-BR.' },
    { role: 'user', content: 'Liste 3 LLMs famosos em uma linha cada.' },
  ],
});

console.log(res.message.content);
```

## ✓ Validar

```bash
cd examples/mini-squad
npm run build
# tsc compila sem erros

# Para um teste live (requer COPILOT_TOKEN configurado):
npx tsx -e "
import { CopilotProvider } from './src/client/index.ts';
const llm = new CopilotProvider();
const r = await llm.chat({ messages: [{ role: 'user', content: 'oi' }] });
console.log(r.message.content);
"
# Saída esperada: alguma resposta natural do modelo.
```

Se o `npm run build` passar, segue para o capítulo de streaming.
