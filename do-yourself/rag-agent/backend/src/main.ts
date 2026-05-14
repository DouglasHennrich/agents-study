import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./@shared/filters/all-exceptions.filter";
import { TEnvService } from "./modules/env/services/env.service";
import helmet from "helmet";

async function bootstrap() {
  process.env.TZ = "UTC";

  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.setGlobalPrefix("api");

  app.useGlobalFilters(new AllExceptionsFilter());

  const envService = app.get(TEnvService);
  const port = envService.get("INFRA_PORT");

  await app.listen(port);

  console.log(`Application running on port ${port}`);
}

bootstrap();
