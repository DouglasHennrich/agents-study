import { Global, Module } from "@nestjs/common";
import { Scope } from "@nestjs/common";
import { ILogger, CustomLogger } from "../classes/custom-logger";

@Global()
@Module({
  providers: [
    {
      provide: ILogger,
      useClass: CustomLogger,
      scope: Scope.TRANSIENT,
    },
  ],
  exports: [ILogger],
})
export class LoggerModule {}
