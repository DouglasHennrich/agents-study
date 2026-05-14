import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { CustomLogger } from "../classes/custom-logger";

const SKIP_PATHS = new Set([
  "/",
  "/health",
  "/api/v1/health",
  "/metrics",
  "/favicon.ico",
]);
const LOG_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new CustomLogger(RequestLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    if (SKIP_PATHS.has(req.path) || !LOG_METHODS.has(req.method)) {
      return next();
    }

    const start = Date.now();
    this.logger.debug(`Incoming Request: ${req.method} ${req.originalUrl}`);

    res.on("finish", () => {
      const duration = Date.now() - start;
      this.logger.debug(
        `Response: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${duration}ms`,
      );
    });

    next();
  }
}
