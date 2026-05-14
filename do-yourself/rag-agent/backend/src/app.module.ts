import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EnvModule } from "./modules/env/env.module";
import { DatabaseModule } from "./@database/database.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { ChatModule } from "./modules/chat/chat.module";
import { LoggerModule } from "./@shared/modules/logger.module";
import { envSchema } from "./modules/env/env";

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (env) => envSchema.parse(env),
      isGlobal: true,
    }),
    LoggerModule,
    EnvModule,
    DatabaseModule,
    DocumentsModule,
    ChatModule,
  ],
})
export class AppModule {}
