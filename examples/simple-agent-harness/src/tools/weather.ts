import type { IAgentTool } from "../types.js";

export const weatherTool: IAgentTool = {
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