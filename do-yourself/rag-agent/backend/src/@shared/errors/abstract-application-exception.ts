import { HttpStatus } from "@nestjs/common";

export interface IRequestContext {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

export abstract class AbstractApplicationException extends Error {
  public readonly httpStatus: HttpStatus;
  public readonly errorCode: string;
  public context?: IRequestContext;

  constructor(
    message: string,
    errorCode: string,
    httpStatus: HttpStatus,
    context?: IRequestContext,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.httpStatus = httpStatus;
    this.context = context;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
