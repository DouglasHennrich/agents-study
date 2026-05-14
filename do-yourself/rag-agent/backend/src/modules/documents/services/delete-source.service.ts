import { Injectable } from "@nestjs/common";
import { AbstractService } from "../../../@shared/classes/service";
import { Result } from "../../../@shared/classes/result";
import { ILogger } from "../../../@shared/classes/custom-logger";
import { IDocumentsRepository } from "../repositories/documents.repository";
import { TDeleteSourceDtoParamSchema } from "../dto/delete-source.dto";

export abstract class TDeleteSourceService extends AbstractService<
  TDeleteSourceDtoParamSchema,
  void
> {}

@Injectable()
export class DeleteSourceService implements TDeleteSourceService {
  constructor(
    /// //////////////////////////
    //  Repositories
    /// //////////////////////////
    private readonly documentsRepository: IDocumentsRepository,

    public logger: ILogger,
  ) {
    this.logger.setContextName(DeleteSourceService.name);
  }

  validateDto(
    dto: TDeleteSourceDtoParamSchema,
  ): Result<TDeleteSourceDtoParamSchema> {
    return Result.success(dto);
  }

  async execute(dto: TDeleteSourceDtoParamSchema): Promise<Result<void>> {
    await this.documentsRepository.deleteBySource(dto.source);
    return Result.success(undefined);
  }
}
