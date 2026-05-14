export class Result<T> {
  private readonly _value: T | null;
  public readonly error?: Error;

  private constructor(value: T | null, error?: Error) {
    this._value = value;
    this.error = error;
  }

  static success<U>(value?: U): Result<U> {
    return new Result<U>(value ?? null);
  }

  static fail<U>(error: Error): Result<U> {
    return new Result<U>(null, error);
  }

  getValue(): T | null {
    return this._value;
  }

  isFailure(): boolean {
    return this.error !== undefined;
  }

  isSuccess(): boolean {
    return this.error === undefined;
  }
}
