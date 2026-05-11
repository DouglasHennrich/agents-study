import { Repository, SelectQueryBuilder } from "typeorm";
import { ILogger } from "./custom-logger";

export interface IPagination<T> {
  data: T[];
  total: number;
  hasNextPage: boolean;
}

export abstract class AbstractRepository<Entity extends object, Model> {
  protected readonly repository: Repository<Entity>;
  protected readonly logger: ILogger;

  constructor(repository: Repository<Entity>, logger: ILogger) {
    this.repository = repository;
    this.logger = logger;
  }

  queryBuilder(alias: string): SelectQueryBuilder<Entity> {
    return this.repository.createQueryBuilder(alias);
  }

  async create(data: Partial<Entity>): Promise<Model> {
    const entity = this.repository.create(data as Entity);
    return this.repository.save(entity) as unknown as Model;
  }

  async find(where: Partial<Entity>): Promise<Model[]> {
    return this.repository.find({ where: where as any }) as unknown as Model[];
  }

  async findAll(): Promise<Model[]> {
    return this.repository.find() as unknown as Model[];
  }

  async findOne(where: Partial<Entity>): Promise<Model | null> {
    return this.repository.findOne({
      where: where as any,
    }) as unknown as Model | null;
  }

  async findById(id: string | number): Promise<Model | null> {
    return this.repository.findOne({
      where: { id } as any,
    }) as unknown as Model | null;
  }

  async findLast(): Promise<Model | null> {
    return this.repository.findOne({
      order: { createdAt: "DESC" } as any,
    }) as unknown as Model | null;
  }

  async count(where?: Partial<Entity>): Promise<number> {
    return this.repository.count({ where: where as any });
  }

  async update(id: string | number, data: Partial<Entity>): Promise<Model> {
    await this.repository.update(id, data as any);
    return this.findById(id) as Promise<Model>;
  }

  async softDelete(id: string | number): Promise<void> {
    await this.repository.softDelete(id);
  }

  async hardDelete(id: string | number): Promise<void> {
    await this.repository.delete(id);
  }

  async restoreSoftDeleted(id: string | number): Promise<void> {
    await this.repository.restore(id);
  }
}
