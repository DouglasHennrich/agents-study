import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AbstractRepository } from "../../../@shared/classes/repository";
import { ILogger } from "../../../@shared/classes/custom-logger";
import { DocumentEntity } from "../entities/document.entity";
import { IDocumentModel, IDocumentMetadata } from "../models/document.struct";

export interface ISimilarDocument {
  id: number;
  content: string;
  metadata: IDocumentMetadata;
  similarity: number;
}

export abstract class IDocumentsRepository extends AbstractRepository<
  DocumentEntity,
  IDocumentModel
> {
  abstract saveBatch(
    items: Array<{
      content: string;
      embedding: number[];
      metadata: IDocumentMetadata;
    }>,
  ): Promise<void>;
  abstract findSimilar(
    queryEmbedding: number[],
    topK: number,
    threshold: number,
  ): Promise<ISimilarDocument[]>;
  abstract findSimilarBySource(
    queryEmbedding: number[],
    source: string,
    topK: number,
  ): Promise<ISimilarDocument[]>;
  abstract listSources(): Promise<string[]>;
  abstract deleteBySource(source: string): Promise<void>;
}

@Injectable()
export class DocumentsRepository extends IDocumentsRepository {
  protected readonly dataSource: DataSource;

  constructor(
    @InjectRepository(DocumentEntity)
    repository: Repository<DocumentEntity>,
    dataSource: DataSource,
    public logger: ILogger,
  ) {
    super(repository, logger);
    this.dataSource = dataSource;
  }

  async saveBatch(
    items: Array<{
      content: string;
      embedding: number[];
      metadata: IDocumentMetadata;
    }>,
  ): Promise<void> {
    if (items.length === 0) return;

    for (const item of items) {
      const embeddingStr = `[${item.embedding.join(",")}]`;
      await this.dataSource.query(
        `INSERT INTO documents (content, embedding, metadata) VALUES ($1, $2::text, $3::jsonb)`,
        [item.content, embeddingStr, JSON.stringify(item.metadata)],
      );
    }
  }

  async findSimilar(
    queryEmbedding: number[],
    topK: number,
    threshold: number,
  ): Promise<ISimilarDocument[]> {
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const rows: Array<{
      id: number;
      content: string;
      metadata: IDocumentMetadata;
      similarity: number;
    }> = await this.dataSource.query(
      `SELECT id, content, metadata, 1 - (embedding::vector <=> $1::vector) AS similarity
         FROM documents
         WHERE embedding IS NOT NULL
           AND 1 - (embedding::vector <=> $1::vector) >= $2
         ORDER BY similarity DESC
         LIMIT $3`,
      [embeddingStr, threshold, topK],
    );
    return rows;
  }

  async findSimilarBySource(
    queryEmbedding: number[],
    source: string,
    topK: number,
  ): Promise<ISimilarDocument[]> {
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const rows: Array<{
      id: number;
      content: string;
      metadata: IDocumentMetadata;
      similarity: number;
    }> = await this.dataSource.query(
      `SELECT id, content, metadata, 1 - (embedding::vector <=> $1::vector) AS similarity
         FROM documents
         WHERE embedding IS NOT NULL
           AND metadata->>'source' = $2
         ORDER BY similarity DESC
         LIMIT $3`,
      [embeddingStr, source, topK],
    );
    return rows;
  }

  async listSources(): Promise<string[]> {
    const rows: Array<{ source: string }> = await this.dataSource.query(
      `SELECT DISTINCT metadata->>'source' AS source FROM documents WHERE metadata->>'source' IS NOT NULL ORDER BY source`,
    );
    return rows.map((r) => r.source);
  }

  async deleteBySource(source: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM documents WHERE metadata->>'source' = $1`,
      [source],
    );
  }
}
