import type { IAgentTool } from "../types.js";

export const calculatorTool: IAgentTool = {
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