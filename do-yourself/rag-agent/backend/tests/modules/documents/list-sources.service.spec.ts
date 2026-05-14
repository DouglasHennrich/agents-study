import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListSourcesService } from '../../../src/modules/documents/services/list-sources.service';

function makeRepositoryMock(sources: string[] = []) {
  return {
    listSources: vi.fn().mockResolvedValue(sources),
    saveBatch: vi.fn(),
    findSimilar: vi.fn(),
    findSimilarBySource: vi.fn(),
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

describe('ListSourcesService', () => {
  it('deve retornar lista de sources do repositório', async () => {
    const repository = makeRepositoryMock(['doc1.pdf', 'doc2.pdf']);
    const service = new ListSourcesService(repository as any);

    const result = await service.execute({});

    expect(result.error).toBeUndefined();
    expect(result.getValue()).toEqual(['doc1.pdf', 'doc2.pdf']);
  });

  it('deve retornar array vazio quando não há documentos', async () => {
    const repository = makeRepositoryMock([]);
    const service = new ListSourcesService(repository as any);

    const result = await service.execute({});

    expect(result.error).toBeUndefined();
    expect(result.getValue()).toEqual([]);
  });
});
