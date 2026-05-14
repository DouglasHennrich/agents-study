import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from '../../../src/modules/chat/services/chat.service';
import { ChatPresenter } from '../../../src/modules/chat/presenters/chat.presenter';
import { EmbeddingProviderStub } from '../../stubs/embedding.provider.stub';
import { LlmProviderStub } from '../../stubs/llm.provider.stub';
import { NoRelevantContextException } from '../../../src/modules/chat/errors/no-relevant-context.exception';
import { DocumentFactory } from '../../factories/document.factory';
import { ChatFactory } from '../../factories/chat.factory';

function makeRepositoryMock(similarDocs = [DocumentFactory.createSimilarDocument()]) {
  return {
    findSimilar: vi.fn().mockResolvedValue(similarDocs),
    findSimilarBySource: vi.fn().mockResolvedValue(similarDocs),
    saveBatch: vi.fn(),
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
        RAG_TOP_K: 5,
        RAG_SIMILARITY_THRESHOLD: 0.6,
      };
      return values[key];
    }),
  };
}

describe('ChatService', () => {
  let embeddingProviderStub: EmbeddingProviderStub;
  let llmProviderStub: LlmProviderStub;
  let chatPresenter: ChatPresenter;
  let envServiceMock: ReturnType<typeof makeEnvServiceMock>;

  beforeEach(() => {
    embeddingProviderStub = new EmbeddingProviderStub();
    llmProviderStub = new LlmProviderStub();
    chatPresenter = new ChatPresenter();
    envServiceMock = makeEnvServiceMock();
  });

  it('deve retornar resposta do LLM com sources formatados', async () => {
    const repositoryMock = makeRepositoryMock();
    const service = new ChatService(
      repositoryMock as any,
      embeddingProviderStub,
      llmProviderStub,
      chatPresenter,
      envServiceMock as any,
    );

    const dto = ChatFactory.createChatDto();
    const result = await service.execute(dto);

    expect(result.error).toBeUndefined();
    const value = result.getValue()!;
    expect(value.answer).toBe('Resposta gerada pelo LLM stub.');
    expect(value.sources).toHaveLength(1);
    expect(value.sources[0].source).toBe('test.pdf');
  });

  it('deve usar findSimilarBySource quando source for fornecido', async () => {
    const repositoryMock = makeRepositoryMock();
    const service = new ChatService(
      repositoryMock as any,
      embeddingProviderStub,
      llmProviderStub,
      chatPresenter,
      envServiceMock as any,
    );

    const dto = ChatFactory.createChatDto({ source: 'test.pdf' });
    await service.execute(dto);

    expect(repositoryMock.findSimilarBySource).toHaveBeenCalledOnce();
    expect(repositoryMock.findSimilar).not.toHaveBeenCalled();
  });

  it('deve retornar NoRelevantContextException quando nenhum chunk encontrado', async () => {
    const repositoryMock = makeRepositoryMock([]);
    const service = new ChatService(
      repositoryMock as any,
      embeddingProviderStub,
      llmProviderStub,
      chatPresenter,
      envServiceMock as any,
    );

    const dto = ChatFactory.createChatDto();
    const result = await service.execute(dto);

    expect(result.error).toBeInstanceOf(NoRelevantContextException);
  });

  it('deve falhar ao validar question vazia', async () => {
    const repositoryMock = makeRepositoryMock();
    const service = new ChatService(
      repositoryMock as any,
      embeddingProviderStub,
      llmProviderStub,
      chatPresenter,
      envServiceMock as any,
    );

    const result = await service.execute({ question: '' });

    expect(result.error).toBeInstanceOf(Error);
  });
});
