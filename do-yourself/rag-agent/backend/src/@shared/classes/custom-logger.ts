import { Logger } from "@nestjs/common";

export abstract class ILogger {
  abstract log(message: string, ...optionalParams: unknown[]): void;
  abstract error(message: string, ...optionalParams: unknown[]): void;
  abstract warn(message: string, ...optionalParams: unknown[]): void;
  abstract debug(message: string, ...optionalParams: unknown[]): void;
  abstract verbose(message: string, ...optionalParams: unknown[]): void;
  abstract setContextName(contextName: string): void;
}

export class CustomLogger extends ILogger {
  private logger: Logger;

  constructor(contextName?: string) {
    super();
    this.logger = new Logger(contextName ?? CustomLogger.name);
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.logger.log(message, ...optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    this.logger.error(message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.logger.warn(message, ...optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.logger.debug(message, ...optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.logger.verbose(message, ...optionalParams);
  }

  setContextName(contextName: string): void {
    this.logger = new Logger(contextName);
  }
}
