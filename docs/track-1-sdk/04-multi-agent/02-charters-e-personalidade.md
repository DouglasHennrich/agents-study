# 02. Charters e personalidade

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Um **Charter** é o **contrato declarativo** de um agent: nome, papel, objetivos, restrições, persona, tools permitidas. Você define em dados (YAML/JSON/objeto TS), e o runtime renderiza o `system prompt` a partir dele.

Por que importa:

- **Auditável** — fácil revisar o que cada agent é.
- **Reutilizável** — o mesmo charter funciona em CLI e em testes.
- **Versionável** — mudanças no comportamento ficam em diff.

## Como o Squad faz

Em `packages/squad-sdk/src/charter/`, charters são objetos com schema Zod, carregados de `.squad/charters/*.yaml`. Há helpers para renderizar como Markdown system prompt — leitura clara para o modelo.

## Construa o seu

Veja [`src/charter/charter.ts`](../../examples/mini-squad/src/charter/charter.ts).

```ts
import type { Charter } from '../charter/charter.js';

export const Coordinator: Charter = {
  name: 'Coordinator',
  role: 'coordenador de orçamentos multi-plataforma',
  persona: 'objetivo, sem floreios, métrico',
  goals: [
    'Receber um pedido com itens e quantidades',
    'Disparar agents de cada plataforma em paralelo',
    'Consolidar e devolver o melhor preço por item',
  ],
  constraints: [
    'Nunca inventar preços — só reportar o que vier das tools',
    'Sempre incluir moeda e data da cotação',
  ],
  tools: ['squad_route', 'squad_status', 'squad_decide'],
};
```

A função `charterToSystemPrompt` (ou `renderSystemPrompt` no `CastingEngine`) monta um prompt estruturado com seções `# Identidade / # Persona / # Objetivos / # Restrições / # Formato`. Isso é mais robusto que prosa solta — o modelo segue melhor.

## ✓ Validar

Conceitual; coberto pelos testes do `CastingEngine` no próximo capítulo.
