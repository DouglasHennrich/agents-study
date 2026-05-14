import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../../@shared/pipes/zod-validation.pipe";
import {
  deleteSourceDtoParamSchema,
  TDeleteSourceDtoParamSchema,
} from "../dto/delete-source.dto";
import { TDeleteSourceService } from "../services/delete-source.service";

@Controller("documents/sources/:source")
export class DeleteSourceController {
  constructor(private readonly deleteSourceService: TDeleteSourceService) {}

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async handle(
    @Param(new ZodValidationPipe(deleteSourceDtoParamSchema))
    { source }: TDeleteSourceDtoParamSchema,
  ): Promise<void> {
    const result = await this.deleteSourceService.execute({ source });
    if (result.error) throw result.error;
  }
}
