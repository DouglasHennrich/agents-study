import { HttpStatus } from "@nestjs/common";
import { AbstractApplicationException } from "../../../@shared/errors/abstract-application-exception";

export class NoRelevantContextException extends AbstractApplicationException {
  constructor() {
    super(
      "Não encontrei informações relevantes nos documentos indexados.",
      "NO_RELEVANT_CONTEXT",
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
