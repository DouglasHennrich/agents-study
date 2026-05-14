import { AsyncLocalStorage } from "async_hooks";

export interface IAsyncContextStore {
  requestId?: string;
  userId?: string;
  userTimezone?: string;
}

export class AsyncContext {
  private static storage = new AsyncLocalStorage<IAsyncContextStore>();

  static run<T>(store: IAsyncContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  static get(): IAsyncContextStore | undefined {
    return this.storage.getStore();
  }

  static getRequestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }

  static getUserId(): string | undefined {
    return this.storage.getStore()?.userId;
  }

  static getUserTimezone(): string | undefined {
    return this.storage.getStore()?.userTimezone;
  }
}
