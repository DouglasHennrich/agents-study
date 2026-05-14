import { Injectable } from "@nestjs/common";
import { OllamaEmbeddings } from "@langchain/ollama";
import { TEnvService } from "../../modules/env/services/env.service";

export abstract class IEmbeddingProvider {
  abstract embed(texts: string[]): Promise<number[][]>;
}

@Injectable()
export class OllamaEmbeddingProvider implements IEmbeddingProvider {
  private readonly ollamaEmbeddings: OllamaEmbeddings;

  constructor(private readonly envService: TEnvService) {
    this.ollamaEmbeddings = new OllamaEmbeddings({
      model: this.envService.get("OLLAMA_EMBEDDING_MODEL"),
      baseUrl: this.envService.get("OLLAMA_BASE_URL"),
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    return this.ollamaEmbeddings.embedDocuments(texts);
  }
}
