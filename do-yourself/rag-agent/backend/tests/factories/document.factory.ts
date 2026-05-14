import { IDocumentModel, IDocumentMetadata } from '../../src/modules/documents/models/document.struct';
import { IIngestResult } from '../../src/modules/documents/models/ingest-result.struct';
import { ISimilarDocument } from '../../src/modules/documents/repositories/documents.repository';

export class DocumentFactory {
  static createDocumentData(overrides: Partial<IDocumentModel> = {}): IDocumentModel {
    return {
      id: 1,
      content: 'Conteúdo de teste do documento.',
      metadata: {
        source: 'test.pdf',
        chunkIndex: 0,
        totalChunks: 1,
        size: 1024,
        mimetype: 'application/pdf',
      },
      embedding: Array(768).fill(0.1),
      createdAt: new Date('2024-01-01'),
      ...overrides,
    };
  }

  static createIngestResult(overrides: Partial<IIngestResult> = {}): IIngestResult {
    return {
      fileName: 'test.pdf',
      chunks: 3,
      status: 'success',
      ...overrides,
    };
  }

  static createSimilarDocument(overrides: Partial<ISimilarDocument> = {}): ISimilarDocument {
    return {
      id: 1,
      content: 'Conteúdo similar encontrado.',
      metadata: {
        source: 'test.pdf',
        chunkIndex: 0,
        totalChunks: 1,
      },
      similarity: 0.85,
      ...overrides,
    };
  }
}
