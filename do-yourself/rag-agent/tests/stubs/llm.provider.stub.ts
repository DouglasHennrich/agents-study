import { ILlmProvider } from '../../src/providers/ollama/llm.provider';

export class LlmProviderStub implements ILlmProvider {
  async invoke(_prompt: string): Promise<string> {
    return 'Resposta gerada pelo LLM stub.';
  }
}
