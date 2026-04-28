import Anthropic from "@anthropic-ai/sdk";
import type { IAgentTool, IToolResult, IAgentState } from "./types.js";

export class AgentHarness {
  private client: Anthropic;
  private tools: Map<string, IAgentTool>;
  private model = "claude-opus-4-6";

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
  registerTool(tool: IAgentTool): this {
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
  ): Promise<IToolResult> {
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
    const state: IAgentState = {
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
        ...(systemPrompt !== undefined && { system: systemPrompt }),
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