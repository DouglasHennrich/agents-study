import { Module } from "@nestjs/common";
import {
  IEmbeddingProvider,
  OllamaEmbeddingProvider,
} from "./embedding.provider";
import { ILlmProvider, OllamaLlmProvider } from "./llm.provider";

@Module({
  providers: [
    {
      provide: IEmbeddingProvider,
      useClass: OllamaEmbeddingProvider,
    },
    {
      provide: ILlmProvider,
      useClass: OllamaLlmProvider,
    },
  ],
  exports: [IEmbeddingProvider, ILlmProvider],
})
export class OllamaModule {}
