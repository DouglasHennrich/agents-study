import { Injectable } from "@nestjs/common";
import { Ollama } from "@langchain/ollama";
import { TEnvService } from "../../modules/env/services/env.service";

export abstract class ILlmProvider {
  abstract invoke(prompt: string): Promise<string>;
}

@Injectable()
export class OllamaLlmProvider implements ILlmProvider {
  private readonly ollama: Ollama;

  constructor(private readonly envService: TEnvService) {
    this.ollama = new Ollama({
      model: this.envService.get("OLLAMA_LLM_MODEL"),
      baseUrl: this.envService.get("OLLAMA_BASE_URL"),
    });
  }

  async invoke(prompt: string): Promise<string> {
    const response = await this.ollama.invoke(prompt);
    return typeof response === "string" ? response : String(response);
  }
}
