import { Injectable } from "@nestjs/common";
import { AbstractService } from "../../../@shared/classes/service";
import { Result } from "../../../@shared/classes/result";
import { ILogger } from "../../../@shared/classes/custom-logger";
import { TEnvService } from "../../env/services/env.service";
import { IDocumentsRepository } from "../../documents/repositories/documents.repository";
import { IEmbeddingProvider } from "../../../providers/ollama/embedding.provider";
import { ILlmProvider } from "../../../providers/ollama/llm.provider";
import {
  IChatPresenter,
  TChatPresenterResponse,
} from "../presenters/chat.presenter";
import { TChatDtoBodySchema } from "../dto/chat.dto";
import { NoRelevantContextException } from "../errors/no-relevant-context.exception";

export abstract class TChatService extends AbstractService<
  TChatDtoBodySchema,
  TChatPresenterResponse
> {}

@Injectable()
export class ChatService implements TChatService {
  constructor(
    /// //////////////////////////
    //  Repositories
    /// //////////////////////////
    private readonly documentsRepository: IDocumentsRepository,

    /// //////////////////////////
    //  Presenters
    /// //////////////////////////
    private readonly chatPresenter: IChatPresenter,

    /// //////////////////////////
    //  Services
    /// //////////////////////////
    private readonly envService: TEnvService,

    /// //////////////////////////
    //  Providers
    /// //////////////////////////
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly llmProvider: ILlmProvider,
    public logger: ILogger,
  ) {
    this.logger.setContextName(ChatService.name);
  }

  validateDto(dto: TChatDtoBodySchema): Result<TChatDtoBodySchema> {
    return Result.success(dto);
  }

  async execute(
    dto: TChatDtoBodySchema,
  ): Promise<Result<TChatPresenterResponse>> {
    const validation = this.validateDto(dto);
    if (validation.error) return Result.fail(validation.error);

    const { question, source, topK } = validation.getValue()!;

    const [queryEmbedding] = await this.embeddingProvider.embed([question]);

    const topKValue = topK ?? this.envService.get("RAG_TOP_K");
    const threshold = this.envService.get("RAG_SIMILARITY_THRESHOLD");

    const similarDocuments = source
      ? await this.documentsRepository.findSimilarBySource(
          queryEmbedding,
          source,
          topKValue,
        )
      : await this.documentsRepository.findSimilar(
          queryEmbedding,
          topKValue,
          threshold,
        );

    if (similarDocuments.length === 0) {
      return Result.fail(new NoRelevantContextException());
    }

    const context = similarDocuments
      .map(
        (doc, idx) =>
          `[Trecho ${idx + 1} - Fonte: ${doc.metadata.source}]\n${doc.content}`,
      )
      .join("\n\n---\n\n");

    const prompt = `Você é um assistente especializado em responder perguntas com base nos documentos fornecidos.
    Responda APENAS com base no contexto abaixo. Se a resposta não estiver no contexto, diga que não encontrou a informação.
    Responda em português do Brasil. Cite o arquivo de origem quando relevante.

    CONTEXTO:
    ${context}

    PERGUNTA: ${question}

    RESPOSTA:`;

    const answer = await this.llmProvider.invoke(prompt);

    return Result.success(
      this.chatPresenter.present({ answer, similarDocuments }),
    );
  }
}
