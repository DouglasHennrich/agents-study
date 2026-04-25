# 01. StorageProvider abstrato

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Persistência é detalhe de implementação — sessions, blobs e auditoria devem funcionar igual contra **memória**, **arquivos**, **SQLite** ou **Postgres**. A solução é uma **interface única** + adapters.

## Como o Squad faz

`packages/squad-sdk/src/storage/` define `StorageProvider` com `saveSession`, `loadSession`, `listSessions`, `putBlob`, `getBlob`. Implementa `FsStorageProvider`, `InMemoryStorageProvider` e (no roadmap) `SqliteStorageProvider`. Cada agent recebe o provider via DI.

## Construa o seu

[`src/storage/types.ts`](../../examples/mini-squad/src/storage/types.ts):

```ts
export interface StorageProvider {
  saveSession(s: AgentSession): Promise<void>;
  loadSession(id: string): Promise<AgentSession | null>;
  listSessions(): Promise<AgentSession[]>;
  deleteSession(id: string): Promise<void>;
  putBlob(key: string, value: unknown): Promise<void>;
  getBlob<T>(key: string): Promise<T | null>;
}
```

Implementações:

- [`InMemoryStorage`](../../examples/mini-squad/src/storage/in-memory-storage.ts) — usa `Map`. `structuredClone` para evitar vazamento de referência.
- [`FileStorage`](../../examples/mini-squad/src/storage/file-storage.ts) — JSON em disco com escrita atômica.

### Exercício: SqliteStorage

Escolha a lib `better-sqlite3` (síncrona, simples) e implemente:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blobs (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
```

`saveSession` vira um `INSERT OR REPLACE`. Bônus: índice em `updated_at` para `listSessions ORDER BY` rápido.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- session
# Os testes da Phase 6 já exercitam FileStorage e InMemoryStorage.
```
