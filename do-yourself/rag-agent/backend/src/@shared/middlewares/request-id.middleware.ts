import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { AsyncContext } from "../classes/async-context";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();
    AsyncContext.run({ requestId }, next);
  }
}
