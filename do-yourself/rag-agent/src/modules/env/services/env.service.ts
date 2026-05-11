import { Injectable } from "@nestjs/common";
import { envSchema, TEnvironment } from "../env";

export abstract class TEnvService {
  abstract get<K extends keyof TEnvironment>(key: K): TEnvironment[K];
}

@Injectable()
export class EnvService implements TEnvService {
  private readonly env: TEnvironment;

  constructor() {
    this.env = envSchema.parse(process.env);
  }

  get<K extends keyof TEnvironment>(key: K): TEnvironment[K] {
    return this.env[key];
  }
}
