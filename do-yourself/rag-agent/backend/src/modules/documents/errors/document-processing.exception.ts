import { HttpStatus } from "@nestjs/common";
import { AbstractApplicationException } from "../../../@shared/errors/abstract-application-exception";

export class DocumentProcessingException extends AbstractApplicationException {
  constructor(fileName: string, reason: string) {
    super(
      `Failed to process document "${fileName}": ${reason}`,
      "DOCUMENT_PROCESSING_ERROR",
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
