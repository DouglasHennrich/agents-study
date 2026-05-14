import { Injectable } from "@nestjs/common";
import { AbstractService } from "../../../@shared/classes/service";
import { Result } from "../../../@shared/classes/result";
import { ILogger } from "../../../@shared/classes/custom-logger";
import { IDocumentsRepository } from "../repositories/documents.repository";

export abstract class TListSourcesService extends AbstractService<
  Record<string, never>,
  string[]
> {}

@Injectable()
export class ListSourcesService implements TListSourcesService {
  constructor(
    /// //////////////////////////
    //  Repositories
    /// //////////////////////////
    private readonly documentsRepository: IDocumentsRepository,

    public logger: ILogger,
  ) {
    this.logger.setContextName(ListSourcesService.name);
  }

  validateDto(_dto: Record<string, never>): Result<Record<string, never>> {
    return Result.success({});
  }

  async execute(_dto: Record<string, never>): Promise<Result<string[]>> {
    const sources = await this.documentsRepository.listSources();
    return Result.success(sources);
  }
}
