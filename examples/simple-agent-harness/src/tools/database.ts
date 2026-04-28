import type { IAgentTool } from "../types.js";

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

export const queryUserTool: IAgentTool = {
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