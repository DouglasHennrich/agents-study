import { HttpStatus } from "@nestjs/common";
import { AbstractApplicationException } from "../../../@shared/errors/abstract-application-exception";

export class NoFilesProvidedException extends AbstractApplicationException {
  constructor() {
    super(
      "No files provided for ingestion.",
      "NO_FILES_PROVIDED",
      HttpStatus.BAD_REQUEST,
    );
  }
}
