import { Injectable } from "@nestjs/common";
import pdfParse from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { AbstractService } from "../../../@shared/classes/service";
import { Result } from "../../../@shared/classes/result";
import { ILogger } from "../../../@shared/classes/custom-logger";
import { TEnvService } from "../../env/services/env.service";
import { IDocumentsRepository } from "../repositories/documents.repository";
import {
  IDocumentPresenter,
  TIngestResultPresenterResponse,
} from "../presenters/document.presenter";
import { IIngestResult } from "../models/ingest-result.struct";
import { NoFilesProvidedException } from "../errors/no-files-provided.exception";
import { InvalidFileTypeException } from "../errors/invalid-file-type.exception";
import { IEmbeddingProvider } from "@/@shared/providers/ollama/embedding.provider";

export interface IIngestDocumentsFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

export abstract class TIngestDocumentsService extends AbstractService<
  IIngestDocumentsFile[],
  TIngestResultPresenterResponse[]
> {}

@Injectable()
export class IngestDocumentsService implements TIngestDocumentsService {
  constructor(
    /// //////////////////////////
    //  Repositories
    /// //////////////////////////
    private readonly documentsRepository: IDocumentsRepository,

    /// //////////////////////////
    //  Services
    /// //////////////////////////
    private readonly envService: TEnvService,

    /// //////////////////////////
    //  Providers
    /// //////////////////////////
    private readonly embeddingProvider: IEmbeddingProvider,

    /// //////////////////////////
    //  Presenters
    /// //////////////////////////
    private readonly documentPresenter: IDocumentPresenter,

    public logger: ILogger,
  ) {
    this.logger.setContextName(IngestDocumentsService.name);
  }

  validateDto(files: IIngestDocumentsFile[]): Result<IIngestDocumentsFile[]> {
    if (!files || files.length === 0) {
      return Result.fail(new NoFilesProvidedException());
    }
    for (const file of files) {
      if (file.mimetype !== "application/pdf") {
        return Result.fail(new InvalidFileTypeException(file.originalname));
      }
    }
    return Result.success(files);
  }

  async execute(
    files: IIngestDocumentsFile[],
  ): Promise<Result<TIngestResultPresenterResponse[]>> {
    const validation = this.validateDto(files);
    if (validation.error) return Result.fail(validation.error);

    const chunkSize = this.envService.get("RAG_CHUNK_SIZE");
    const chunkOverlap = this.envService.get("RAG_CHUNK_OVERLAP");

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    const results: IIngestResult[] = [];

    for (const file of files) {
      try {
        const parsed = await pdfParse(file.buffer);
        const text = parsed.text?.trim();

        if (!text) {
          results.push({
            fileName: file.originalname,
            chunks: 0,
            status: "error",
            error: "No text extracted",
          });
          continue;
        }

        const chunks = await splitter.splitText(text);
        const totalChunks = chunks.length;

        const embeddings = await this.embeddingProvider.embed(chunks);

        const items = chunks.map((content, idx) => ({
          content,
          embedding: embeddings[idx],
          metadata: {
            source: file.originalname,
            chunkIndex: idx,
            totalChunks,
            size: file.buffer.length,
            mimetype: file.mimetype,
          },
        }));

        await this.documentsRepository.saveBatch(items);

        results.push({
          fileName: file.originalname,
          chunks: totalChunks,
          status: "success",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          fileName: file.originalname,
          chunks: 0,
          status: "error",
          error: message,
        });
      }
    }

    return Result.success(this.documentPresenter.presentMany(results));
  }
}
