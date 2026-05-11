import { describe, it, expect, vi } from 'vitest';
import { DeleteSourceService } from '../../../src/modules/documents/services/delete-source.service';

function makeRepositoryMock() {
  return {
    deleteBySource: vi.fn().mockResolvedValue(undefined),
    saveBatch: vi.fn(),
    findSimilar: vi.fn(),
    findSimilarBySource: vi.fn(),
    listSources: vi.fn(),
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

describe('DeleteSourceService', () => {
  it('deve chamar deleteBySource com o source correto', async () => {
    const repository = makeRepositoryMock();
    const service = new DeleteSourceService(repository as any);

    await service.execute({ source: 'meu-arquivo.pdf' });

    expect(repository.deleteBySource).toHaveBeenCalledWith('meu-arquivo.pdf');
  });

  it('deve retornar Result.success(undefined)', async () => {
    const repository = makeRepositoryMock();
    const service = new DeleteSourceService(repository as any);

    const result = await service.execute({ source: 'qualquer.pdf' });

    expect(result.error).toBeUndefined();
    expect(result.getValue()).toBeNull();
  });
});
