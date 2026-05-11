import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestDocumentsService, IIngestDocumentsFile } from '../../../src/modules/documents/services/ingest-documents.service';
import { DocumentPresenter } from '../../../src/modules/documents/presenters/document.presenter';
import { EmbeddingProviderStub } from '../../stubs/embedding.provider.stub';
import { NoFilesProvidedException } from '../../../src/modules/documents/errors/no-files-provided.exception';
import { InvalidFileTypeException } from '../../../src/modules/documents/errors/invalid-file-type.exception';

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({ text: 'Texto extraído do PDF para teste unitário.' }),
}));

// Mock langchain text splitter
vi.mock('langchain/text_splitter', () => ({
  RecursiveCharacterTextSplitter: vi.fn().mockImplementation(() => ({
    splitText: vi.fn().mockResolvedValue(['chunk 1', 'chunk 2', 'chunk 3']),
  })),
}));

function makeRepositoryMock() {
  return {
    saveBatch: vi.fn().mockResolvedValue(undefined),
    findSimilar: vi.fn(),
    findSimilarBySource: vi.fn(),
    listSources: vi.fn(),
    deleteBySource: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    findLast: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    hardDelete: vi.fn(),
    restoreSoftDeleted: vi.fn(),
    queryBuilder: vi.fn(),
    repository: {} as any,
    dataSource: {} as any,
  };
}

function makeEnvServiceMock() {
  return {
    get: vi.fn().mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        RAG_CHUNK_SIZE: 500,
        RAG_CHUNK_OVERLAP: 50,
      };
      return values[key];
    }),
  };
}

function makePdfFile(overrides: Partial<IIngestDocumentsFile> = {}): IIngestDocumentsFile {
  return {
    originalname: 'test.pdf',
    buffer: Buffer.from('fake pdf content'),
    mimetype: 'application/pdf',
    ...overrides,
  };
}

describe('IngestDocumentsService', () => {
  let service: IngestDocumentsService;
  let repositoryMock: ReturnType<typeof makeRepositoryMock>;
  let embeddingProviderStub: EmbeddingProviderStub;
  let envServiceMock: ReturnType<typeof makeEnvServiceMock>;
  let documentPresenter: DocumentPresenter;

  beforeEach(() => {
    repositoryMock = makeRepositoryMock();
    embeddingProviderStub = new EmbeddingProviderStub();
    envServiceMock = makeEnvServiceMock();
    documentPresenter = new DocumentPresenter();

    service = new IngestDocumentsService(
      repositoryMock as any,
      embeddingProviderStub,
      envServiceMock as any,
      documentPresenter,
    );
  });

  it('deve processar múltiplos PDFs e retornar resultados de sucesso', async () => {
    const files = [makePdfFile({ originalname: 'a.pdf' }), makePdfFile({ originalname: 'b.pdf' })];

    const result = await service.execute(files);

    expect(result.error).toBeUndefined();
    const value = result.getValue()!;
    expect(value).toHaveLength(2);
    expect(value[0].status).toBe('success');
    expect(value[1].status).toBe('success');
    expect(value[0].chunks).toBe(3);
  });

  it('deve retornar status error para arquivo sem texto extraível', async () => {
    const { default: pdfParse } = await import('pdf-parse');
    vi.mocked(pdfParse).mockResolvedValueOnce({ text: '   ', numpages: 0, numrender: 0, info: {}, metadata: null, version: '' });

    const files = [makePdfFile()];
    const result = await service.execute(files);

    expect(result.error).toBeUndefined();
    const value = result.getValue()!;
    expect(value[0].status).toBe('error');
  });

  it('deve retornar NoFilesProvidedException quando array vazio', async () => {
    const result = await service.execute([]);

    expect(result.error).toBeInstanceOf(NoFilesProvidedException);
  });

  it('deve chamar saveBatch com os embeddings gerados', async () => {
    const files = [makePdfFile()];
    await service.execute(files);

    expect(repositoryMock.saveBatch).toHaveBeenCalledOnce();
    const callArgs = repositoryMock.saveBatch.mock.calls[0][0];
    expect(callArgs).toHaveLength(3); // 3 chunks do mock
    expect(callArgs[0]).toHaveProperty('embedding');
    expect(callArgs[0].embedding).toHaveLength(768);
  });

  it('deve retornar InvalidFileTypeException para arquivo não PDF', async () => {
    const files = [makePdfFile({ mimetype: 'image/png', originalname: 'image.png' })];
    const result = await service.execute(files);

    expect(result.error).toBeInstanceOf(InvalidFileTypeException);
  });
});
