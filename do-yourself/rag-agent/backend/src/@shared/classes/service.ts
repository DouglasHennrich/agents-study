import { Result } from "./result";
import { IRequestContext } from "../errors/abstract-application-exception";

export abstract class AbstractService<Dto, Response> {
  abstract execute(
    dto: Dto,
    context?: IRequestContext,
  ): Promise<Result<Response>>;
  abstract validateDto(dto: Dto): Result<Dto>;
}
