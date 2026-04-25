# 02. Crash recovery

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Agent travou? Conexão caiu? Você matou o processo? Sem **crash recovery** você perde tudo: histórico, decisões, progresso. A regra de ouro:

> **Persistir após cada mutação observável** (turn do LLM, tool call, decisão).

## Como o Squad faz

O Squad usa `FsStorage`/`SqliteStorage`. Cada `appendMessages` flusha a sessão inteira em arquivo (escrita atômica via `tmp + rename`). No reboot, `resumeSession(id)` recarrega.

Detalhe importante: **escrita atômica** evita arquivos corrompidos se o processo morrer no meio de um `write`.

## Construa o seu

[`src/storage/file-storage.ts`](../../examples/mini-squad/src/storage/file-storage.ts) implementa `writeAtomic`:

```ts
const tmp = `${file}.tmp-${pid}-${Date.now()}`;
await fs.writeFile(tmp, data);
await fs.rename(tmp, file);   // operação atômica em POSIX
```

E `SessionPool.resume(id)`:

```ts
const pool = new SessionPool(new FileStorage('.mini-squad'));
const s = await pool.resume('uuid-da-sessao');
console.log(s.messages.length); // recuperado!
```

### Padrão geral de recovery

1. CLI grava o `sessionId` em algum lugar conhecido (`.mini-squad/last-session`).
2. Em `mini-squad resume`, lê o id, faz `pool.resume(id)`.
3. O loop continua do último turno persistido — não re-executa tools já realizadas.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- session
# ✓ SessionPool > persiste e resume com FileStorage (crash recovery)
# ✓ SessionPool > InMemoryStorage também suporta resume dentro do mesmo processo
```
