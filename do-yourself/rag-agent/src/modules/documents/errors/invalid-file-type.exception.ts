import { HttpStatus } from "@nestjs/common";
import { AbstractApplicationException } from "../../../@shared/errors/abstract-application-exception";

export class InvalidFileTypeException extends AbstractApplicationException {
  constructor(fileName: string) {
    super(
      `Invalid file type for "${fileName}". Only PDF files are accepted.`,
      "INVALID_FILE_TYPE",
      HttpStatus.BAD_REQUEST,
    );
  }
}
