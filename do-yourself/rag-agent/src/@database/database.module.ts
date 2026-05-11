import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { join } from "path";
import { TEnvService } from "../modules/env/services/env.service";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [TEnvService],
      useFactory: (envService: TEnvService) => ({
        type: "postgres",
        host: envService.get("DATABASE_HOST"),
        port: envService.get("DATABASE_PORT"),
        username: envService.get("DATABASE_USER"),
        password: envService.get("DATABASE_PASSWORD"),
        database: envService.get("DATABASE_NAME"),
        entities: [join(__dirname, "../modules/**/*.entity{.ts,.js}")],
        migrations: [join(__dirname, "./migrations/*{.ts,.js}")],
        logging: envService.get("INFRA_ENVIRONMENT") === "development",
        timezone: "UTC",
        extra: {
          timezone: "UTC",
          connectionTimeZone: "UTC",
          max: 30,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
