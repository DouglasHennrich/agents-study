import { ConsoleLogger, Injectable, Scope } from "@nestjs/common";
import { AsyncContext } from "./async-context";

export abstract class ILogger {
  abstract setContextName(contextName: string): void;
  abstract log(message: string, context?: unknown): void;
  abstract error(message: string, context?: unknown): void;
  abstract warn(message: string, context?: unknown): void;
  abstract debug(message: string, context?: unknown): void;
  abstract verbose(message: string, context?: unknown): void;
}

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger extends ConsoleLogger implements ILogger {
  setContextName(contextName: string): void {
    this.context = contextName;
  }

  private buildMessage(message: string, context?: unknown): string {
    const requestId = AsyncContext.getRequestId();
    const parts: string[] = [];
    if (requestId) parts.push(`[${requestId}]`);
    parts.push(message);
    if (context !== undefined) parts.push(JSON.stringify(context));
    return parts.join(" ");
  }

  log(message: string, context?: unknown): void {
    super.log(this.buildMessage(message, context));
  }

  error(message: string, context?: unknown): void {
    super.error(this.buildMessage(message, context));
  }

  warn(message: string, context?: unknown): void {
    super.warn(this.buildMessage(message, context));
  }

  debug(message: string, context?: unknown): void {
    super.debug(this.buildMessage(message, context));
  }

  verbose(message: string, context?: unknown): void {
    super.verbose(this.buildMessage(message, context));
  }
}
