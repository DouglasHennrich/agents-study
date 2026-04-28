# AI Agent Harness para Dummies — Tutorial Completo em TypeScript

> **O que você vai aprender:** o que é um agent harness, como o loop funciona por dentro, e como construir um do zero em TypeScript com exemplos que você pode copiar e executar agora.

---

## Índice

1. [O que é um Agent Harness?](#1-o-que-é-um-agent-harness)
2. [Como o Loop Funciona (Anatomia)](#2-como-o-loop-funciona-anatomia)
3. [Setup do Projeto](#3-setup-do-projeto)
4. [Tipos e Interfaces](#4-tipos-e-interfaces)
5. [O Harness — Código Central](#5-o-harness--código-central)
6. [Criando Tools](#6-criando-tools)
7. [Juntando Tudo — Exemplo Completo](#7-juntando-tudo--exemplo-completo)
8. [Como Executar](#8-como-executar)
9. [Dicas para Produção](#9-dicas-para-produção)
10. [Orquestração de Agents — O Próximo Nível](#10-orquestração-de-agents--o-próximo-nível)

---

## 1. O que é um Agent Harness?

Um **Agent Harness** é o código que transforma um LLM (modelo de linguagem) em um **agent autônomo** — capaz de raciocinar, decidir que ações tomar, executar essas ações, e continuar até resolver a tarefa.

### A analogia do gerente de projeto

Imagine um gerente de projeto humano recebendo uma tarefa:

1. Ele **pensa** no que precisa fazer
2. **Delega** para as pessoas/ferramentas certas
3. **Espera** os resultados
4. **Analisa** os resultados e decide o próximo passo
5. Repete até a tarefa estar **concluída**

O harness faz exatamente isso — mas com um LLM no lugar do gerente.

### As 3 peças do sistema

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│     LLM      │     │   Harness    │     │        Tools         │
│  (o cérebro) │◄───►│  (o maestro) │◄───►│  (os braços)         │
│              │     │              │     │  funções TypeScript   │
│  Decide o    │     │  Orquestra   │     │  que fazem coisas    │
│  que fazer   │     │  o loop      │     │  reais no mundo      │
└──────────────┘     └──────────────┘     └──────────────────────┘
```

### Fluxo geral

```
Usuário
  │
  ▼
Harness ──────► Claude API
                    │
                    ▼
              "Quero usar a tool X"
                    │
                    ▼
Harness ──────► Executa tool X (função TS)
                    │
                    ▼
              Resultado volta ao Claude
                    │
                    ▼
              "Agora tenho os dados, vou responder"
                    │
                    ▼
              Resposta final ──────► Usuário
```

---

## 2. Como o Loop Funciona (Anatomia)

O coração do harness é um `while` simples. Cada iteração tem 3 possibilidades:

```
while (não terminou && iterações < máximo) {

  1. Chama o LLM com todo o histórico da conversa
         │
         ▼
  2. LLM responde com stop_reason:
     ├── "end_turn"   → LLM terminou → retorna resposta final ✅
     └── "tool_use"   → LLM quer chamar tool(s)
                            │
                            ▼
  3. Harness executa as tools solicitadas
     Adiciona resultados ao histórico
     Volta ao passo 1
}
```

### Por que `role: "user"` nos resultados das tools?

A API Anthropic exige **alternância estrita de turnos**: `user → assistant → user → assistant → ...`

Os resultados das tools entram como `role: "user"` para manter essa alternância. Sem isso, a API rejeita a requisição.

```
messages = [
  { role: "user",      content: "Pergunta do usuário" },
  { role: "assistant", content: [tool_use_block] },        ← Claude pediu uma tool
  { role: "user",      content: [tool_result_block] },     ← resultado da tool
  { role: "assistant", content: "Resposta final" },        ← Claude conclui
]
```

### Exemplo real de uma execução

Pergunta: *"Qual o tempo em São Paulo e quanto é 15% de 340?"*

```
Iteração 1:
  → Claude recebe a pergunta
  ← stop_reason: "tool_use"
     calls: [get_weather("São Paulo"), calculator("340 * 0.15")]

Execução:
  get_weather  → { city: "São Paulo", temperature: 24 }
  calculator   → "Resultado: 51"

Iteração 2:
  → Histórico agora inclui os resultados
  ← stop_reason: "end_turn"
     text: "Em São Paulo está 24°C. E 15% de 340 é igual a 51."

✅ Fim do loop
```

> **Atenção:** Sempre defina um `maxIterations`. Um agent mal instruído pode entrar em loop infinito chamando tools sem chegar a uma conclusão — gerando custo e latência desnecessários.

---

## 3. Setup do Projeto

### Estrutura de arquivos que vamos criar

```
meu-agent/
├── .env
├── package.json
├── tsconfig.json
├── types.ts          ← interfaces compartilhadas
├── harness.ts        ← o harness (loop do agent)
├── index.ts          ← ponto de entrada
└── tools/
    ├── calculator.ts
    ├── weather.ts
    └── database.ts
```

### Passo a passo

```bash
# 1. Criar o projeto
mkdir meu-agent && cd meu-agent
npm init -y

# 2. Instalar dependências
npm install @anthropic-ai/sdk dotenv
npm install -D typescript tsx @types/node

# 3. Gerar tsconfig
npx tsc --init --target ES2022 --module NodeNext --moduleResolution NodeNext --strict
```

### Configurar variáveis de ambiente

Crie o arquivo `.env` na raiz:

```
ANTHROPIC_API_KEY=sk-ant-...
```

> Você pode obter sua API key em [console.anthropic.com](https://console.anthropic.com).

---

## 4. Tipos e Interfaces

Crie o arquivo `types.ts`:

```typescript
// types.ts
import Anthropic from "@anthropic-ai/sdk";

/**
 * Uma "tool" que o agent pode usar.
 * É basicamente uma função TypeScript com metadados
 * que o LLM usa para saber quando e como chamá-la.
 */
export interface AgentTool {
  // Identificador único — Claude usa este nome para invocar a tool
  name: string;

  // Explica O QUÊ a tool faz.
  // Quanto melhor a descrição, mais assertivo Claude será na escolha certa.
  description: string;

  // JSON Schema dos parâmetros que a tool aceita
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required: string[];
  };

  // A função que REALMENTE executa quando Claude solicitar
  execute: (input: Record<string, unknown>) => Promise<string>;
}

/**
 * Resultado de uma execução de tool
 */
export interface ToolResult {
  toolUseId: string;  // ID que liga o resultado ao pedido do Claude
  content: string;    // Resultado em string (pode ser JSON serializado)
  isError: boolean;   // Se verdadeiro, Claude saberá que houve erro
}

/**
 * Estado interno do loop do agent
 */
export interface AgentState {
  messages: Anthropic.MessageParam[];  // Histórico completo da conversa
  iteration: number;                   // Iteração atual
  maxIterations: number;               // Limite de segurança
  finished: boolean;                   // Se o loop deve parar
}
```

---

## 5. O Harness — Código Central

Este é o arquivo mais importante. Leia com calma — cada parte tem comentário explicando o porquê.

Crie o arquivo `harness.ts`:

```typescript
// harness.ts
import Anthropic from "@anthropic-ai/sdk";
import { AgentTool, ToolResult, AgentState } from "./types.js";

export class AgentHarness {
  private client: Anthropic;
  private tools: Map<string, AgentTool>;
  private model = "claude-opus-4-5";

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    // Map garante busca O(1) pelo nome da tool
    this.tools = new Map();
  }

  /**
   * Registra uma tool no harness.
   * Retorna `this` para permitir encadeamento:
   *   harness.registerTool(a).registerTool(b).registerTool(c)
   */
  registerTool(tool: AgentTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  /**
   * Converte nossas tools internas para o formato que a API Anthropic espera.
   * Claude recebe esta lista e decide quais chamar.
   */
  private getToolsForAPI(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  /**
   * Executa uma tool específica pelo nome.
   * Captura erros para que o agent possa continuar mesmo se uma tool falhar.
   */
  private async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    toolUseId: string
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    // Tool não encontrada — informa o Claude
    if (!tool) {
      return {
        toolUseId,
        content: `Erro: tool "${toolName}" não está registrada no harness.`,
        isError: true,
      };
    }

    try {
      const result = await tool.execute(toolInput);
      return { toolUseId, content: result, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        toolUseId,
        content: `Erro ao executar ${toolName}: ${msg}`,
        isError: true,
      };
    }
  }

  /**
   * ══════════════════════════════════════════════════════
   * O LOOP PRINCIPAL DO AGENT
   * ══════════════════════════════════════════════════════
   *
   * Recebe uma mensagem do usuário e orquestra o loop
   * até o Claude chegar a uma resposta final.
   */
  async run(
    userMessage: string,
    systemPrompt?: string,
    maxIterations = 10
  ): Promise<string> {
    // Estado inicial: apenas a mensagem do usuário no histórico
    const state: AgentState = {
      messages: [{ role: "user", content: userMessage }],
      iteration: 0,
      maxIterations,
      finished: false,
    };

    console.log(`\n🤖 Agent iniciado | max ${maxIterations} iterações`);
    console.log(`📝 Mensagem: ${userMessage}\n`);

    // ── LOOP PRINCIPAL ────────────────────────────────────
    while (!state.finished && state.iteration < state.maxIterations) {
      state.iteration++;
      console.log(`\n──── Iteração ${state.iteration} de ${state.maxIterations} ────`);

      // PASSO 1: Chama o Claude com todo o histórico + tools disponíveis
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: this.getToolsForAPI(),
        messages: state.messages,
      });

      console.log(`Stop reason: ${response.stop_reason}`);

      // Adiciona a resposta do Claude ao histórico (role: "assistant")
      state.messages.push({
        role: "assistant",
        content: response.content,
      });

      // PASSO 2: Analisa o stop_reason para decidir o próximo passo

      // ── Caso A: Claude terminou ── retorna resposta final
      if (response.stop_reason === "end_turn") {
        state.finished = true;

        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === "text"
        );

        return textBlock?.text ?? "(Agent terminou sem resposta textual)";
      }

      // ── Caso B: Claude quer usar tools ──
      if (response.stop_reason === "tool_use") {
        // Pega todos os blocos de tool_use (pode ser mais de um!)
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
        );

        // Array que vai acumular os resultados de todas as tools
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        // Executa cada tool solicitada
        for (const block of toolUseBlocks) {
          console.log(`  🔧 Chamando tool: ${block.name}`);
          console.log(`     Input: ${JSON.stringify(block.input)}`);

          const result = await this.executeTool(
            block.name,
            block.input as Record<string, unknown>,
            block.id
          );

          const preview = result.content.substring(0, 100);
          console.log(`     Resultado: ${preview}${result.content.length > 100 ? "..." : ""}`);
          console.log(`     Erro: ${result.isError}`);

          // Adiciona o resultado no formato que a API espera
          toolResults.push({
            type: "tool_result",
            tool_use_id: result.toolUseId,
            content: result.content,
            is_error: result.isError,
          });
        }

        // PASSO 3: Adiciona os resultados ao histórico como "user"
        // (lembra da alternância obrigatória de turnos)
        state.messages.push({
          role: "user",
          content: toolResults,
        });

        // O while vai recomeçar com o histórico atualizado
      }
    }

    // Atingiu o limite de iterações sem terminar
    return `Agent atingiu o limite de ${state.maxIterations} iterações sem concluir a tarefa.`;
  }
}
```

---

## 6. Criando Tools

Cada tool é um objeto que segue a interface `AgentTool`. Pode ser qualquer função async — chamada de API, banco de dados, cálculo, filesystem, etc.

### Tool 1 — Calculadora

Crie `tools/calculator.ts`:

```typescript
// tools/calculator.ts
import { AgentTool } from "../types.js";

export const calculatorTool: AgentTool = {
  name: "calculator",

  // A description é o que Claude lê para decidir SE e QUANDO usar a tool.
  // Seja específico: o que ela faz, quando usar, o que retorna.
  description:
    "Realiza cálculos matemáticos. Use para somas, subtrações, multiplicações, " +
    "divisões, porcentagens e expressões compostas. " +
    "Exemplos de input: '10 + 5', '(100 * 0.15)', '(340 / 7).toFixed(2)'",

  inputSchema: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "Expressão matemática JavaScript válida. Ex: '(10 + 5) * 3'",
      },
    },
    required: ["expression"],
  },

  execute: async ({ expression }) => {
    // ⚠️  Em produção, use mathjs ou vm.runInContext() para sandbox seguro
    // Não use Function() com input de usuário não confiável!
    const result = Function(`"use strict"; return (${expression})`)();
    return `Resultado de ${expression} = ${result}`;
  },
};
```

### Tool 2 — Clima (simulado)

Crie `tools/weather.ts`:

```typescript
// tools/weather.ts
import { AgentTool } from "../types.js";

export const weatherTool: AgentTool = {
  name: "get_weather",

  description:
    "Retorna a temperatura atual de uma cidade brasileira. " +
    "Use quando o usuário perguntar sobre clima, temperatura ou tempo em uma cidade. " +
    "Retorna um JSON com city, temperature e unit.",

  inputSchema: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "Nome da cidade. Ex: 'São Paulo', 'Rio de Janeiro', 'Curitiba'",
      },
    },
    required: ["city"],
  },

  execute: async ({ city }) => {
    // Simulando uma chamada de API com delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Em produção: chame OpenWeatherMap, WeatherAPI, etc.
    const temperatures: Record<string, number> = {
      "São Paulo": 24,
      "Rio de Janeiro": 32,
      "Curitiba": 18,
      "Brasília": 26,
      "Salvador": 30,
      "Fortaleza": 33,
      "Porto Alegre": 20,
      "Manaus": 35,
    };

    const temperature =
      temperatures[city as string] ?? Math.floor(Math.random() * 20 + 15);

    return JSON.stringify({
      city,
      temperature,
      unit: "Celsius",
      description: temperature > 30 ? "Quente" : temperature > 22 ? "Agradável" : "Fresco",
    });
  },
};
```

### Tool 3 — Banco de dados (simulado)

Crie `tools/database.ts`:

```typescript
// tools/database.ts
import { AgentTool } from "../types.js";

// Simula um banco de dados de usuários
const fakeDatabase: Record<string, object> = {
  "123": {
    id: "123",
    name: "Douglas",
    plan: "Pro",
    totalOrders: 42,
    memberSince: "2022-03-15",
    email: "douglas@example.com",
  },
  "456": {
    id: "456",
    name: "Maria",
    plan: "Free",
    totalOrders: 7,
    memberSince: "2024-01-20",
    email: "maria@example.com",
  },
  "789": {
    id: "789",
    name: "João",
    plan: "Enterprise",
    totalOrders: 198,
    memberSince: "2021-07-01",
    email: "joao@example.com",
  },
};

export const queryUserTool: AgentTool = {
  name: "query_user",

  description:
    "Busca dados de um usuário pelo ID. " +
    "Retorna nome, plano, total de pedidos, data de cadastro e email. " +
    "Use quando precisar de informações sobre um cliente específico.",

  inputSchema: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "ID numérico do usuário. Ex: '123', '456'",
      },
    },
    required: ["userId"],
  },

  execute: async ({ userId }) => {
    // Em produção: faça uma query real no banco com TypeORM, Prisma, etc.
    await new Promise((resolve) => setTimeout(resolve, 100)); // simula latência

    const user = fakeDatabase[userId as string];

    if (!user) {
      return JSON.stringify({
        error: true,
        message: `Usuário com ID ${userId} não encontrado no banco de dados.`,
      });
    }

    return JSON.stringify(user);
  },
};
```

---

## 7. Juntando Tudo — Exemplo Completo

Crie o arquivo `index.ts`:

```typescript
// index.ts
import "dotenv/config";
import { AgentHarness } from "./harness.js";
import { calculatorTool } from "./tools/calculator.js";
import { weatherTool } from "./tools/weather.js";
import { queryUserTool } from "./tools/database.js";

async function main() {
  // Cria o harness e registra todas as tools disponíveis
  const harness = new AgentHarness(process.env.ANTHROPIC_API_KEY!);

  harness
    .registerTool(calculatorTool)
    .registerTool(weatherTool)
    .registerTool(queryUserTool);

  // System prompt: instrui o comportamento geral do agent
  const systemPrompt = `
    Você é um assistente inteligente com acesso a ferramentas.
    
    Regras:
    - Sempre use as ferramentas disponíveis quando precisar de dados externos
    - Nunca invente dados — se não souber, use uma tool
    - Responda de forma clara e objetiva em português brasileiro
    - Quando usar múltiplas tools, apresente os resultados de forma organizada
  `;

  // ── Exemplo 1: múltiplas tools em paralelo ──────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("EXEMPLO 1: Múltiplas tools em paralelo");
  console.log("=".repeat(60));

  const resposta1 = await harness.run(
    "Qual o tempo em São Paulo e no Rio de Janeiro? E quanto é 15% de 340?",
    systemPrompt,
    10
  );

  console.log("\n✅ RESPOSTA FINAL:");
  console.log(resposta1);

  // ── Exemplo 2: raciocínio encadeado ────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("EXEMPLO 2: Raciocínio encadeado (tool → calcula com resultado)");
  console.log("=".repeat(60));

  const resposta2 = await harness.run(
    `Busque os dados do usuário 123.
     Com base no total de pedidos dele, calcule quantos pedidos ele faria em 5 anos 
     mantendo o mesmo ritmo médio desde a data de cadastro até hoje (abril de 2026).`,
    systemPrompt,
    10
  );

  console.log("\n✅ RESPOSTA FINAL:");
  console.log(resposta2);

  // ── Exemplo 3: pergunta simples (sem tools) ─────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("EXEMPLO 3: Sem tools (Claude responde direto)");
  console.log("=".repeat(60));

  const resposta3 = await harness.run(
    "O que é um agent AI em uma frase?",
    systemPrompt,
    5
  );

  console.log("\n✅ RESPOSTA FINAL:");
  console.log(resposta3);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
```

---

## 8. Como Executar

### Opção A — Direto com `tsx` (recomendado para desenvolvimento)

Não precisa compilar, roda TypeScript direto:

```bash
npx tsx index.ts
```

### Opção B — Compilar e rodar

```bash
# Compila TypeScript para JavaScript
npx tsc

# Roda o JavaScript gerado
node dist/index.js
```

### Output esperado

```
============================================================
EXEMPLO 1: Múltiplas tools em paralelo
============================================================

🤖 Agent iniciado | max 10 iterações
📝 Mensagem: Qual o tempo em São Paulo e no Rio de Janeiro?...

──── Iteração 1 de 10 ────
Stop reason: tool_use
  🔧 Chamando tool: get_weather
     Input: {"city":"São Paulo"}
     Resultado: {"city":"São Paulo","temperature":24,"unit":"Celsius",...}
  🔧 Chamando tool: get_weather
     Input: {"city":"Rio de Janeiro"}
     Resultado: {"city":"Rio de Janeiro","temperature":32,"unit":"Celsius",...}
  🔧 Chamando tool: calculator
     Input: {"expression":"340 * 0.15"}
     Resultado: Resultado de 340 * 0.15 = 51

──── Iteração 2 de 10 ────
Stop reason: end_turn

✅ RESPOSTA FINAL:
Em São Paulo está 24°C (agradável) e no Rio de Janeiro está 32°C (quente).
Já 15% de 340 é igual a 51.
```

---

## 9. Dicas para Produção

### 1. Valide os inputs das tools com Zod

Claude geralmente gera inputs corretos, mas não sempre. Proteja suas tools:

```typescript
import { z } from "zod";

const WeatherInput = z.object({
  city: z.string().min(2).max(100),
});

execute: async (rawInput) => {
  const { city } = WeatherInput.parse(rawInput); // lança se inválido
  // ... resto da lógica
}
```

### 2. Adicione retry com backoff nas chamadas de API

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
      console.log(`Tentativa ${attempt} falhou. Retry em ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

// Uso:
const response = await withRetry(() =>
  this.client.messages.create({ ... })
);
```

### 3. Persista o histórico para conversas longas

```typescript
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });

// Salva histórico
await redis.set(
  `agent:history:${sessionId}`,
  JSON.stringify(state.messages),
  { EX: 60 * 60 * 24 } // expira em 24h
);

// Restaura histórico
const raw = await redis.get(`agent:history:${sessionId}`);
const history = raw ? JSON.parse(raw) : [];
```

### 4. Use streaming para respostas em tempo real

```typescript
const stream = await this.client.messages.stream({
  model: this.model,
  max_tokens: 4096,
  messages: state.messages,
  tools: this.getToolsForAPI(),
});

// Envia tokens para o usuário conforme chegam
for await (const chunk of stream) {
  if (
    chunk.type === "content_block_delta" &&
    chunk.delta.type === "text_delta"
  ) {
    process.stdout.write(chunk.delta.text); // ou: websocket.send(chunk.delta.text)
  }
}
```

### 5. Logue cada iteração para debug

Em produção você vai precisar entender por que o agent tomou uma decisão. Use estrutura de log:

```typescript
import pino from "pino";

const logger = pino({ level: "info" });

logger.info({
  iteration: state.iteration,
  toolsCalled: toolUseBlocks.map((b) => ({ name: b.name, input: b.input })),
  stopReason: response.stop_reason,
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
}, "Agent iteration");
```

### 6. Agents paralelos para tasks independentes

```typescript
const [resultado1, resultado2, resultado3] = await Promise.all([
  new AgentHarness(apiKey).registerTool(weatherTool).run("Tempo em SP?"),
  new AgentHarness(apiKey).registerTool(weatherTool).run("Tempo em RJ?"),
  new AgentHarness(apiKey).registerTool(calculatorTool).run("Quanto é 15% de 340?"),
]);
```

### 7. Escreva system prompts robustos

O system prompt controla o comportamento do agent. Inclua:

```
Você é [descrição do papel].

FERRAMENTAS DISPONÍVEIS:
- Use [tool_x] quando [situação específica]
- Use [tool_y] quando [outra situação]

REGRAS:
- Nunca invente dados — sempre use as tools
- Se uma tool falhar, informe o usuário e tente uma alternativa
- Responda sempre em [idioma]
- Seja [tom: objetivo/detalhado/formal/informal]

LIMITES:
- Não faça mais de [N] chamadas de tool por resposta
- Se não souber, diga que não sabe
```

---

## 10. Orquestração de Agents — O Próximo Nível

Até agora construímos um único agent com tools. Mas e quando a tarefa é grande demais ou complexa demais para um único agent resolver sozinho?

A resposta é **orquestração**: um agent central (o **orquestrador**) que decompõe o problema, delega partes para **agents workers** especializados rodando em paralelo, coleta apenas os resultados (não os contextos internos), e decide o próximo passo com base neles.

### A analogia da empresa

```
                    ┌─────────────────────────┐
                    │   ORQUESTRADOR (CEO)     │
                    │                          │
                    │  • Conhece apenas os     │
                    │    resultados finais      │
                    │  • Não sabe como cada    │
                    │    worker chegou lá      │
                    │  • Decide o próximo passo│
                    └────────────┬────────────┘
                                 │ delega
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
   │  WORKER A        │ │  WORKER B        │ │  WORKER C        │
   │  (Pesquisador)   │ │  (Analista)      │ │  (Redator)       │
   │                  │ │                  │ │                  │
   │  Contexto        │ │  Contexto        │ │  Contexto        │
   │  próprio e       │ │  próprio e       │ │  próprio e       │
   │  isolado         │ │  isolado         │ │  isolado         │
   │                  │ │                  │ │                  │
   │  Retorna só      │ │  Retorna só      │ │  Retorna só      │
   │  o resultado     │ │  o resultado     │ │  o resultado     │
   └──────────────────┘ └──────────────────┘ └──────────────────┘
```

### Por que isso importa — o problema do contexto

Sem orquestração, se você colocar tudo em um único agent, o contexto (histórico de mensagens) cresce rapidamente:

```
Agent único lidando com pesquisa + análise + redação:
  messages = [
    ... 50 mensagens de pesquisa ...
    ... 40 mensagens de análise ...
    ... 30 mensagens de redação ...
  ]
  → Context window enorme → caro + lento + propenso a erros
```

Com orquestração:

```
Orquestrador:
  messages = [
    { role: "user",      content: "Tarefa principal" },
    { role: "assistant", content: "Vou dividir em 3 subtarefas..." },
    { role: "user",      content: "RESULTADO worker_pesquisa: ..." },   ← só o resultado
    { role: "user",      content: "RESULTADO worker_analise: ..." },    ← só o resultado
    { role: "assistant", content: "Com base nisso, vou para fase 2..." },
  ]
  → Contexto mínimo → barato + rápido + focado
```

### O padrão fundamental

```
┌─────────────────────────────────────────────────────────────┐
│                      ORQUESTRADOR                           │
│                                                             │
│  FASE 1: Planejamento                                       │
│    → Claude decide quais workers criar e com qual tarefa    │
│                                                             │
│  FASE 2: Execução Paralela (Promise.all)                    │
│    → Lança N workers ao mesmo tempo, cada um isolado        │
│    → Workers rodam seus próprios loops internos             │
│    → Workers retornam apenas strings de resultado           │
│                                                             │
│  FASE 3: Síntese                                           │
│    → Orquestrador recebe só os resultados                   │
│    → Claude decide: concluir ou criar nova rodada?          │
│    → Repete até o processo estar completo                   │
└─────────────────────────────────────────────────────────────┘
```

---

### 10.1 Novos tipos para orquestração

Adicione em `types.ts`:

```typescript
// types.ts — adicionar ao arquivo existente

/**
 * Descrição de uma subtarefa que o orquestrador
 * vai delegar para um worker agent.
 */
export interface SubTask {
  id: string;           // Identificador único, ex: "pesquisa_mercado"
  description: string;  // Instrução completa para o worker
  tools: string[];      // Nomes das tools que este worker pode usar
}

/**
 * Resultado que um worker devolve ao orquestrador.
 * O orquestrador NUNCA vê o histórico interno do worker —
 * apenas este objeto.
 */
export interface WorkerResult {
  subTaskId: string;    // Qual subtarefa foi executada
  success: boolean;     // Se o worker concluiu sem erros críticos
  result: string;       // Resultado em texto (pode ser JSON)
  iterations: number;   // Quantas iterações o worker usou (para monitoramento)
  error?: string;       // Mensagem de erro, se houver
}

/**
 * Uma "fase" do processo orquestrado.
 * O orquestrador executa N fases em sequência,
 * cada fase podendo ter M workers em paralelo.
 */
export interface OrchestrationPhase {
  phaseId: string;
  phaseName: string;
  subTasks: SubTask[];
  results: WorkerResult[];
  completedAt?: Date;
}

/**
 * Estado completo do orquestrador.
 * Cresce com os resultados de cada fase,
 * mas NUNCA com o histórico interno dos workers.
 */
export interface OrchestratorState {
  objective: string;
  phases: OrchestrationPhase[];
  currentPhase: number;
  finished: boolean;
  finalOutput?: string;
}
```

---

### 10.2 O Worker Agent

O worker é um `AgentHarness` comum, mas configurado para uma subtarefa específica. Ele roda seu loop completo internamente e retorna **apenas o resultado final** — o orquestrador jamais vê o que aconteceu dentro.

Crie `orchestration/worker.ts`:

```typescript
// orchestration/worker.ts
import Anthropic from "@anthropic-ai/sdk";
import { AgentTool, WorkerResult, SubTask } from "../types.js";

export class WorkerAgent {
  private client: Anthropic;
  private tools: Map<string, AgentTool>;
  private model = "claude-opus-4-5";

  constructor(apiKey: string, availableTools: AgentTool[]) {
    this.client = new Anthropic({ apiKey });
    this.tools = new Map(availableTools.map((t) => [t.name, t]));
  }

  private getToolsForAPI(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  private async executeTool(
    name: string,
    input: Record<string, unknown>,
    id: string
  ): Promise<Anthropic.ToolResultBlockParam> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { type: "tool_result", tool_use_id: id,
               content: `Tool "${name}" não encontrada.`, is_error: true };
    }
    try {
      const content = await tool.execute(input);
      return { type: "tool_result", tool_use_id: id, content, is_error: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: "tool_result", tool_use_id: id,
               content: `Erro: ${msg}`, is_error: true };
    }
  }

  /**
   * Executa a subtarefa completa de forma isolada.
   *
   * O worker tem seu próprio histórico de mensagens — completamente
   * separado do orquestrador e dos outros workers.
   * Ao terminar, descarta tudo e devolve apenas o resultado.
   */
  async execute(subTask: SubTask, maxIterations = 8): Promise<WorkerResult> {
    // Histórico local — isolado, nunca vaza para fora
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: subTask.description },
    ];

    const systemPrompt = `
      Você é um agente especializado executando uma subtarefa específica.
      Execute a tarefa com as ferramentas disponíveis e retorne um resultado
      claro e completo. Seja objetivo — sua resposta final será usada por
      um orquestrador, não por um humano diretamente.
    `;

    let iteration = 0;

    console.log(`    [Worker ${subTask.id}] Iniciado`);

    while (iteration < maxIterations) {
      iteration++;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        tools: this.getToolsForAPI(),
        messages,
      });

      // Adiciona resposta ao histórico LOCAL do worker
      messages.push({ role: "assistant", content: response.content });

      // Worker terminou — retorna apenas o texto final
      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find(
          (b): b is Anthropic.TextBlock => b.type === "text"
        );
        const result = textBlock?.text ?? "(worker sem output textual)";

        console.log(`    [Worker ${subTask.id}] Concluído em ${iteration} iteração(ões)`);

        return {
          subTaskId: subTask.id,
          success: true,
          result,
          iterations: iteration,
        };
      }

      // Worker quer usar tools — executa e continua o loop
      if (response.stop_reason === "tool_use") {
        const toolBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );

        const toolResults = await Promise.all(
          toolBlocks.map((b) =>
            this.executeTool(b.name, b.input as Record<string, unknown>, b.id)
          )
        );

        messages.push({ role: "user", content: toolResults });
      }
    }

    // Atingiu limite de iterações
    return {
      subTaskId: subTask.id,
      success: false,
      result: "",
      iterations: maxIterations,
      error: `Worker atingiu ${maxIterations} iterações sem concluir.`,
    };
  }
}
```

---

### 10.3 O Orquestrador

O orquestrador é o componente mais sofisticado. Ele usa o próprio Claude para **planejar** as fases, **coordenar** os workers e **sintetizar** os resultados — mas seu contexto cresce só com resumos, nunca com detalhes internos dos workers.

Crie `orchestration/orchestrator.ts`:

```typescript
// orchestration/orchestrator.ts
import Anthropic from "@anthropic-ai/sdk";
import { AgentTool, SubTask, WorkerResult, OrchestratorState } from "../types.js";
import { WorkerAgent } from "./worker.js";

export class Orchestrator {
  private client: Anthropic;
  private toolRegistry: Map<string, AgentTool>;
  private apiKey: string;
  private model = "claude-opus-4-5";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new Anthropic({ apiKey });
    this.toolRegistry = new Map();
  }

  /** Registra uma tool que pode ser delegada a qualquer worker */
  registerTool(tool: AgentTool): this {
    this.toolRegistry.set(tool.name, tool);
    return this;
  }

  // ── Helpers internos ───────────────────────────────────────────────────────

  /** Resolve os nomes de tools para as instâncias reais */
  private resolveTools(toolNames: string[]): AgentTool[] {
    return toolNames
      .map((name) => this.toolRegistry.get(name))
      .filter((t): t is AgentTool => t !== undefined);
  }

  /**
   * Pede ao Claude para planejar a próxima fase do processo.
   * O orquestrador descreve o objetivo e o que já foi feito,
   * e Claude decide quais subtarefas criar (ou se está pronto para concluir).
   */
  private async planNextPhase(
    state: OrchestratorState
  ): Promise<{ done: boolean; subTasks?: SubTask[]; phaseName?: string }> {

    const availableTools = Array.from(this.toolRegistry.keys()).join(", ");

    // Monta um resumo do que já foi feito para o orquestrador
    const progressSummary = state.phases.map((phase) => {
      const resultSummaries = phase.results.map(
        (r) => `  - [${r.subTaskId}]: ${r.success ? r.result.substring(0, 300) : "ERRO: " + r.error}`
      ).join("\n");
      return `FASE "${phase.phaseName}":\n${resultSummaries}`;
    }).join("\n\n");

    const planningPrompt = `
Você é um orquestrador de processos. Seu objetivo é:
"${state.objective}"

Tools disponíveis para os workers: ${availableTools}

${state.phases.length > 0
  ? `O que já foi concluído:\n${progressSummary}`
  : "Nenhuma fase foi executada ainda."}

Decida o próximo passo. Responda EXATAMENTE em um destes formatos JSON:

Opção A — Se há mais trabalho a fazer:
{
  "done": false,
  "phaseName": "Nome descritivo desta fase",
  "subTasks": [
    {
      "id": "identificador_unico_sem_espacos",
      "description": "Instrução completa e detalhada para o worker executar",
      "tools": ["nome_da_tool_1", "nome_da_tool_2"]
    }
  ]
}

Opção B — Se o objetivo foi totalmente atingido:
{
  "done": true
}

REGRAS:
- Subtarefas dentro de uma mesma fase rodam EM PARALELO — não crie dependências entre elas
- Se a tarefa B depende do resultado da tarefa A, coloque-as em fases separadas
- Cada worker recebe apenas as tools que ele realmente precisa
- Seja específico nas descriptions — o worker não tem contexto externo
- Retorne APENAS o JSON, sem texto adicional
    `;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: planningPrompt }],
    });

    const text = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )?.text ?? "{}";

    // Remove possíveis backticks de markdown antes de parsear
    const clean = text.replace(/```json|```/g, "").trim();

    try {
      return JSON.parse(clean);
    } catch {
      console.error("Erro ao parsear plano do orquestrador:", text);
      return { done: true }; // Aborta com segurança
    }
  }

  /**
   * Executa todos os workers de uma fase em paralelo.
   * Cada worker tem seu próprio contexto isolado.
   * O orquestrador recebe apenas os resultados finais.
   */
  private async executePhaseInParallel(
    subTasks: SubTask[]
  ): Promise<WorkerResult[]> {
    console.log(`\n  🚀 Lançando ${subTasks.length} worker(s) em paralelo...`);

    // Promise.all garante execução paralela real
    const results = await Promise.all(
      subTasks.map((subTask) => {
        // Cada worker é uma instância isolada — contexto próprio
        const worker = new WorkerAgent(
          this.apiKey,
          this.resolveTools(subTask.tools)
        );
        return worker.execute(subTask);
      })
    );

    return results;
  }

  /**
   * Pede ao Claude para sintetizar todos os resultados
   * e produzir o output final para o usuário.
   */
  private async synthesizeFinalOutput(
    state: OrchestratorState
  ): Promise<string> {
    const allResults = state.phases.flatMap((phase) =>
      phase.results.map(
        (r) => `[${phase.phaseName} / ${r.subTaskId}]:\n${r.result}`
      )
    ).join("\n\n---\n\n");

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `
Objetivo original: "${state.objective}"

Resultados coletados de todos os workers:
${allResults}

Com base nesses resultados, produza uma resposta final completa, coesa e bem formatada
para o usuário. Sintetize as informações, elimine redundâncias e estruture claramente.
          `,
        },
      ],
    });

    return response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )?.text ?? "(síntese vazia)";
  }

  // ── Método principal ───────────────────────────────────────────────────────

  /**
   * ══════════════════════════════════════════════════════════════
   * LOOP PRINCIPAL DO ORQUESTRADOR
   * ══════════════════════════════════════════════════════════════
   *
   * 1. Planeja a próxima fase (Claude decide quais subtarefas criar)
   * 2. Lança os workers em paralelo
   * 3. Coleta apenas os resultados (não o histórico interno)
   * 4. Adiciona resultados ao estado do orquestrador
   * 5. Repete até Claude declarar "done: true"
   * 6. Sintetiza o output final
   */
  async run(objective: string, maxPhases = 5): Promise<string> {
    const state: OrchestratorState = {
      objective,
      phases: [],
      currentPhase: 0,
      finished: false,
    };

    console.log(`\n${"═".repeat(60)}`);
    console.log(`🎯 ORQUESTRADOR INICIADO`);
    console.log(`   Objetivo: ${objective}`);
    console.log(`   Tools disponíveis: ${Array.from(this.toolRegistry.keys()).join(", ")}`);
    console.log(`${"═".repeat(60)}`);

    while (!state.finished && state.currentPhase < maxPhases) {
      state.currentPhase++;

      console.log(`\n📋 FASE ${state.currentPhase}: Planejando...`);

      // PASSO 1: Orquestrador planeja a próxima fase
      const plan = await this.planNextPhase(state);

      // Orquestrador decidiu que está tudo pronto
      if (plan.done) {
        console.log(`\n✅ Orquestrador decidiu: objetivo atingido!`);
        state.finished = true;
        break;
      }

      if (!plan.subTasks || plan.subTasks.length === 0) {
        console.log(`\n⚠️  Plano retornou sem subtarefas. Encerrando.`);
        state.finished = true;
        break;
      }

      console.log(`   Fase: "${plan.phaseName}"`);
      console.log(`   Subtarefas: ${plan.subTasks.map((t) => t.id).join(", ")}`);

      // PASSO 2: Executa todos os workers desta fase em paralelo
      const results = await this.executePhaseInParallel(plan.subTasks);

      // PASSO 3: Registra a fase com apenas os resultados (não os históricos)
      state.phases.push({
        phaseId: `phase_${state.currentPhase}`,
        phaseName: plan.phaseName!,
        subTasks: plan.subTasks,
        results,
        completedAt: new Date(),
      });

      // Log dos resultados desta fase
      console.log(`\n  📦 Resultados da fase "${plan.phaseName}":`);
      results.forEach((r) => {
        const status = r.success ? "✅" : "❌";
        const preview = r.result.substring(0, 120).replace(/\n/g, " ");
        console.log(`    ${status} [${r.subTaskId}]: ${preview}...`);
      });
    }

    // PASSO 4: Síntese final
    console.log(`\n${"─".repeat(60)}`);
    console.log(`🔮 Sintetizando output final...`);

    const finalOutput = await this.synthesizeFinalOutput(state);
    state.finalOutput = finalOutput;

    return finalOutput;
  }
}
```

---

### 10.4 Exemplo Completo com Orquestrador

Crie `orchestration/index-orchestrator.ts`:

```typescript
// orchestration/index-orchestrator.ts
import "dotenv/config";
import { Orchestrator } from "./orchestrator.js";
import { calculatorTool } from "../tools/calculator.js";
import { weatherTool } from "../tools/weather.js";
import { queryUserTool } from "../tools/database.js";

// Tool extra para simular busca de produtos
import { AgentTool } from "../types.js";

const searchProductsTool: AgentTool = {
  name: "search_products",
  description: "Busca produtos mais vendidos de uma categoria.",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string", description: "Categoria do produto" },
      limit: { type: "string", description: "Quantidade máxima de resultados" },
    },
    required: ["category"],
  },
  execute: async ({ category, limit }) => {
    await new Promise((r) => setTimeout(r, 150));
    const products: Record<string, object[]> = {
      "eletrônicos": [
        { name: "Notebook Pro X", price: 4500, sales: 1200 },
        { name: "Smartphone Z10", price: 2800, sales: 3400 },
        { name: "Tablet Vision", price: 1900, sales: 890 },
      ],
      "roupas": [
        { name: "Camiseta Básica", price: 59, sales: 8900 },
        { name: "Calça Slim", price: 189, sales: 4200 },
      ],
    };
    const n = parseInt(limit as string) || 3;
    const result = products[category as string]?.slice(0, n) ?? [];
    return JSON.stringify({ category, products: result });
  },
};

const analyzeMetricsTool: AgentTool = {
  name: "analyze_metrics",
  description: "Calcula métricas de performance de vendas (ticket médio, receita total).",
  inputSchema: {
    type: "object",
    properties: {
      productsJson: { type: "string", description: "JSON com array de produtos com price e sales" },
    },
    required: ["productsJson"],
  },
  execute: async ({ productsJson }) => {
    const { products } = JSON.parse(productsJson as string);
    const totalRevenue = products.reduce(
      (sum: number, p: { price: number; sales: number }) => sum + p.price * p.sales, 0
    );
    const avgTicket = totalRevenue / products.reduce(
      (sum: number, p: { sales: number }) => sum + p.sales, 0
    );
    return JSON.stringify({
      totalRevenue: totalRevenue.toFixed(2),
      avgTicket: avgTicket.toFixed(2),
      topProduct: products.sort(
        (a: { sales: number }, b: { sales: number }) => b.sales - a.sales
      )[0]?.name,
    });
  },
};

async function main() {
  const orchestrator = new Orchestrator(process.env.ANTHROPIC_API_KEY!);

  // Registra todas as tools que qualquer worker pode receber
  orchestrator
    .registerTool(weatherTool)
    .registerTool(queryUserTool)
    .registerTool(calculatorTool)
    .registerTool(searchProductsTool)
    .registerTool(analyzeMetricsTool);

  // ── Exemplo 1: Relatório de negócios com múltiplas fases ───────────────
  console.log("\n\n" + "█".repeat(60));
  console.log("EXEMPLO 1: Relatório completo de negócios");
  console.log("█".repeat(60));

  const relatorio = await orchestrator.run(
    `Crie um relatório executivo completo sobre nossa operação:
     1) Busque dados dos usuários 123 e 456
     2) Busque os produtos mais vendidos de eletrônicos e roupas
     3) Calcule as métricas de performance de cada categoria
     4) Verifique o clima em São Paulo e Curitiba (afeta logística)
     Ao final, consolide tudo em um relatório executivo com insights e recomendações.`,
    5
  );

  console.log("\n\n" + "═".repeat(60));
  console.log("RELATÓRIO FINAL:");
  console.log("═".repeat(60));
  console.log(relatorio);

  // ── Exemplo 2: Processo em 2 fases com dependência ─────────────────────
  console.log("\n\n" + "█".repeat(60));
  console.log("EXEMPLO 2: Análise com fases dependentes");
  console.log("█".repeat(60));

  const analise = await orchestrator.run(
    `Análise de clientes premium:
     Fase 1 - Coleta: busque dados dos usuários 123, 456 e 789 simultaneamente.
     Fase 2 - Análise: com os dados coletados, calcule a média de pedidos entre eles
     e identifique qual usuário está mais acima da média e em quanto por cento.`,
    5
  );

  console.log("\n\n" + "═".repeat(60));
  console.log("ANÁLISE FINAL:");
  console.log("═".repeat(60));
  console.log(analise);
}

main().catch((err) => {
  console.error("Erro fatal no orquestrador:", err);
  process.exit(1);
});
```

Execute com:

```bash
npx tsx orchestration/index-orchestrator.ts
```

---

### 10.5 O que acontece internamente — Visualizado

Aqui está um trace completo do **Exemplo 2** para você entender cada etapa:

```
═══════════════════════════════════════════════════════════════
🎯 ORQUESTRADOR INICIADO
   Objetivo: "Análise de clientes premium..."
═══════════════════════════════════════════════════════════════

📋 FASE 1: Planejando...
   → Claude recebe: objetivo + nenhuma fase anterior
   ← Claude retorna: {
       "done": false,
       "phaseName": "Coleta de dados dos usuários",
       "subTasks": [
         { "id": "busca_user_123", tools: ["query_user"], description: "..." },
         { "id": "busca_user_456", tools: ["query_user"], description: "..." },
         { "id": "busca_user_789", tools: ["query_user"], description: "..." }
       ]
     }

  🚀 Lançando 3 workers em paralelo...

    [Worker busca_user_123] ──── contexto isolado ────
      messages: [user: "Busque usuário 123"]
      → Claude chama query_user(123)
      ← { name: "Douglas", orders: 42, ... }
      → Claude responde: "Dados do usuário 123: Douglas, 42 pedidos..."
      Retorna: "Dados do usuário 123: Douglas, 42 pedidos..."

    [Worker busca_user_456] ──── contexto isolado ────  (paralelo ↑)
      messages: [user: "Busque usuário 456"]
      → Claude chama query_user(456)
      ← { name: "Maria", orders: 7, ... }
      Retorna: "Dados do usuário 456: Maria, 7 pedidos..."

    [Worker busca_user_789] ──── contexto isolado ────  (paralelo ↑)
      messages: [user: "Busque usuário 789"]
      → Claude chama query_user(789)
      ← { name: "João", orders: 198, ... }
      Retorna: "Dados do usuário 789: João, 198 pedidos..."

  📦 Resultados da fase "Coleta de dados":
    ✅ [busca_user_123]: Douglas, 42 pedidos...
    ✅ [busca_user_456]: Maria, 7 pedidos...
    ✅ [busca_user_789]: João, 198 pedidos...

──────────────────────────────────────────────────────────────
  Estado do orquestrador após fase 1:
  messages (orquestrador) = (ZERO — o orquestrador não tem messages próprias!)
  state.phases[0].results = [3 resultados resumidos]  ← só isso!
──────────────────────────────────────────────────────────────

📋 FASE 2: Planejando...
   → Claude recebe: objetivo + resultados da fase 1
   ← Claude retorna: {
       "done": false,
       "phaseName": "Cálculo e análise comparativa",
       "subTasks": [
         {
           "id": "calculo_media",
           tools: ["calculator"],
           description": "Calcule: média = (42+7+198)/3 = ?
                         Depois calcule % acima da média para João (198)."
         }
       ]
     }

  🚀 Lançando 1 worker...

    [Worker calculo_media] ──── contexto isolado ────
      → Claude chama calculator("(42 + 7 + 198) / 3")
      ← "Resultado: 82.33"
      → Claude chama calculator("((198 - 82.33) / 82.33) * 100")
      ← "Resultado: 140.49"
      Retorna: "Média: 82,33 pedidos. João está 140,49% acima da média."

📋 FASE 3: Planejando...
   → Claude recebe: objetivo + resultados das fases 1 e 2
   ← Claude retorna: { "done": true }

🔮 Sintetizando output final...

═══════════════════════════════════════════════════════════════
ANÁLISE FINAL:
═══════════════════════════════════════════════════════════════
Entre os três clientes analisados, a média de pedidos é de 82,33.
João se destaca amplamente, com 198 pedidos — 140% acima da média,
o que o classifica claramente como cliente premium de alto valor...
```

---

### 10.6 Princípios fundamentais da orquestração

**1. Isolamento de contexto é intencional**

Cada worker começa com um histórico vazio. Isso é uma funcionalidade, não uma limitação. Workers que não carregam contexto desnecessário são mais rápidos, mais baratos e menos propensos a "esquecer" o objetivo por distrações no histórico.

**2. O orquestrador só vê resultados, nunca históricos**

```typescript
// ✅ O que o orquestrador recebe de cada worker:
{ subTaskId: "busca_user_123", success: true, result: "Douglas, 42 pedidos...", iterations: 2 }

// ❌ O que o orquestrador NUNCA vê:
[
  { role: "user",      content: "Busque usuário 123" },
  { role: "assistant", content: [tool_use_block] },
  { role: "user",      content: [tool_result_block] },
  { role: "assistant", content: "Douglas tem 42 pedidos..." },
]
```

**3. Paralelo dentro da fase, sequencial entre fases**

```
Fase 1: [worker A] [worker B] [worker C]   ← rodam ao mesmo tempo
              ↓           ↓          ↓
         resultado   resultado   resultado
                       ↓
Fase 2: [worker D (usa resultados da fase 1)]   ← roda depois
```

Se D depende de A, B e C, coloque-os em fases separadas. Se A, B e C são independentes, coloque-os na mesma fase.

**4. O orquestrador usa Claude para planejar, não lógica hardcoded**

Em vez de programar `if (fase == 1) { faça X }`, você descreve o objetivo em linguagem natural e deixa o Claude decidir quantas fases criar, quais subtarefas cada uma tem e quando parar. Isso torna o orquestrador adaptável a qualquer tipo de tarefa.

**5. Sempre tenha `maxPhases` como guard**

```typescript
// Sem isso, um objetivo mal formulado pode criar fases infinitas
await orchestrator.run("Meu objetivo", maxPhases = 5);
```

---

### 10.7 Estrutura de arquivos atualizada

```
meu-agent/
├── .env
├── package.json
├── tsconfig.json
├── types.ts                              ← atualizado com novos tipos
├── harness.ts                            ← agent único (seções anteriores)
├── index.ts                              ← exemplos do agent único
├── tools/
│   ├── calculator.ts
│   ├── weather.ts
│   └── database.ts
└── orchestration/
    ├── worker.ts                         ← agent worker isolado
    ├── orchestrator.ts                   ← orquestrador com loop de fases
    └── index-orchestrator.ts             ← exemplos do orquestrador
```

---

## Resumo do que foi construído

| Arquivo | Responsabilidade |
|---------|-----------------|
| `types.ts` | Interfaces TypeScript para agent único e orquestração |
| `harness.ts` | Loop do agent único com tools |
| `tools/*.ts` | Tools reutilizáveis por qualquer agent |
| `orchestration/worker.ts` | Agent worker isolado — executa subtarefa e retorna resultado |
| `orchestration/orchestrator.ts` | Orquestrador — planeja fases, lança workers, sintetiza |
| `orchestration/index-orchestrator.ts` | Exemplos completos do orquestrador |

### O fluxo completo em uma linha

> **Objetivo → Orquestrador planeja fase → Workers rodam em paralelo (isolados) → Apenas resultados voltam → Orquestrador decide próxima fase → Repete → Síntese final**

---

## Próximos passos

- **MCP (Model Context Protocol):** ferramentas padronizadas e reutilizáveis entre projetos
- **Workers especializados:** cada tipo de worker (pesquisa, análise, escrita) com seu próprio system prompt e conjunto de tools fixo
- **Hierarquia de orquestradores:** um orquestrador de alto nível que delega para sub-orquestradores especializados
- **Computer use:** agents que controlam interfaces gráficas como parte do pipeline
- **Avaliação (evals):** scripts que testam se o orquestrador decompõe tarefas corretamente em cenários variados

---

*Tutorial criado para TypeScript + Anthropic SDK + Claude claude-opus-4-5*
