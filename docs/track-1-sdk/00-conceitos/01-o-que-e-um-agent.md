# 01. O que é um agent

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Um **agent** é um programa cujo "cérebro" é um LLM e cujas "mãos" são **tools** (funções que podem ler/escrever arquivos, chamar APIs, etc.). Diferente de um chatbot, o agent decide **quais tools chamar, em que ordem e com quais argumentos**, observa o resultado e segue iterando até concluir uma tarefa.

A fórmula mínima:

```
agent = LLM + tools + memória + loop
```

| Componente | Papel |
|---|---|
| **LLM** | Decide o próximo passo (raciocínio + escolha de tool). |
| **Tools** | Permitem que o LLM **agir** no mundo real. |
| **Memória** | Histórico de mensagens da sessão (tokens). |
| **Loop** | Continua até o LLM dizer "terminei" ou um limite ser atingido. |

## Como o Squad faz

No Squad, um agent é uma combinação de:

- **Charter** — identidade declarativa (nome, rol, persona). Vira um `system prompt`.
- **Session** — instância "viva" do agent, com histórico, tools e provedor LLM.
- **Runtime** — engine que executa o loop ReAct (próximo capítulo).

Referência: `packages/squad-sdk/src/charter/`, `packages/squad-sdk/src/session/`.

> O Squad mistura "agent" (definição estática) com "session" (instância em execução). Vamos manter essa distinção desde o início.

## Construa o seu

Em `examples/mini-squad/` (que criaremos na Phase 2), um agent será:

```ts
interface AgentDefinition {
  name: string;        // "Coordinator"
  systemPrompt: string;
  tools: Tool[];       // tools disponíveis
  model?: string;      // opcional; padrão do Copilot SDK
}
```

E uma session:

```ts
interface AgentSession {
  id: string;
  agent: AgentDefinition;
  messages: Message[];   // histórico
  status: 'idle' | 'running' | 'done' | 'error';
}
```

Por enquanto, apenas conceitual. Implementaremos no capítulo 02.

## ✓ Validar

Você deve ser capaz de responder:

1. Qual a diferença entre um chatbot e um agent? *(o agent decide e age, não só responde)*
2. O que é o "loop" de um agent? *(LLM → tool call → observation → LLM …)*
3. Onde mora a "personalidade" no Squad? *(no Charter)*

Sem comandos a rodar ainda — Phase 2 começa o código.
