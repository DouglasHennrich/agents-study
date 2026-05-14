import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ZodError } from "zod";
import { AbstractApplicationException } from "../errors/abstract-application-exception";
import { ILogger } from "../classes/custom-logger";
import { AsyncContext } from "../classes/async-context";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: ILogger) {
    this.logger.setContextName(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof AbstractApplicationException) {
      response.status(exception.httpStatus).json({
        statusCode: exception.httpStatus,
        errorCode: exception.errorCode,
        message: exception.message,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
      return;
    }

    if (exception instanceof ZodError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        errors: exception.errors,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        statusCode: status,
        message: exception.message,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
      return;
    }

    this.logger.error("Unexpected error", {
      requestId: AsyncContext.getRequestId(),
      error: exception instanceof Error ? exception.stack : String(exception),
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
