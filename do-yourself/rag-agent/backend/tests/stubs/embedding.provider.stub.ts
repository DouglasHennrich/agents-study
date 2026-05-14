import { IEmbeddingProvider } from '../../src/providers/ollama/embedding.provider';

export class EmbeddingProviderStub implements IEmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => Array(768).fill(0.1));
  }
}
