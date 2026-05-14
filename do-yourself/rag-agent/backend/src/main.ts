import helmet from "helmet";
import express, { NextFunction, Request, Response } from "express";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./@shared/filters/all-exceptions.filter";
import { TEnvService } from "./modules/env/services/env.service";
import { CustomLogger } from "./@shared/classes/custom-logger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { RequestIdMiddleware } from "./@shared/middlewares/request-id.middleware";
import { RequestLoggerMiddleware } from "./@shared/middlewares/request-logger.middleware";

process.env.TZ = "UTC";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: "*", // Allow all origins, adjust as necessary for production
      allowedHeaders: "Content-Type, Accept, Authorization, x-user-timezone",
    },
  });

  const envService = app.get(TEnvService);
  const logger = new CustomLogger("Bootstrap");
  const port = envService.get("INFRA_PORT");

  /// //////////////////////////
  //  Middlewares
  /// //////////////////////////
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  app.use(express.json({ limit: "1gb" }));
  app.use(express.urlencoded({ limit: "1gb", extended: true }));

  const requestIdMiddleware = app.get(RequestIdMiddleware);
  app.use((req: Request, res: Response, next: NextFunction) =>
    requestIdMiddleware.use(req, res, next),
  );

  const requestLoggerMiddleware = app.get(RequestLoggerMiddleware);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (["GET", "POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return requestLoggerMiddleware.use(req, res, next);
    }

    next();
  });

  /// //////////////////////////
  //  Add prefix to all routes
  /// //////////////////////////
  app.setGlobalPrefix("api");

  /// //////////////////////////
  //  Global exceptions handler
  /// //////////////////////////
  app.useGlobalFilters(new AllExceptionsFilter(new CustomLogger()));

  /// //////////////////////////
  //  Start server
  /// //////////////////////////
  await app.listen(port);

  logger.log(`Backend is running on port ${envService.get("INFRA_PORT")}`);
}

bootstrap();
