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