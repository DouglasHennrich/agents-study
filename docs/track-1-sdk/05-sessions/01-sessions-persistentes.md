# 01. Sessions persistentes

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Uma **session** é uma instância viva de um agent: o histórico de mensagens, o status, a relação pai-filho com outras sessions. Persistir sessions permite:

- Continuar uma conversa amanhã.
- Reprocessar bugs com o histórico exato.
- Auditar o que cada agent disse/fez.

## Como o Squad faz

`packages/squad-sdk/src/session/` define `Session`, `SessionPool`, e usa o `StorageProvider` (Phase 7) para persistência. Sessions têm `parentId` quando criadas via `squad_route` — isso forma uma **árvore de delegação**.

## Construa o seu

[`src/session/session.ts`](../../examples/mini-squad/src/session/session.ts):

```ts
const pool = new SessionPool(new FileStorage('.mini-squad'));
const s = await pool.create(coordAgent);

await pool.appendMessages(s.id, [{ role: 'user', content: 'orçamento de 10 mouses' }]);
await pool.update(s.id, { status: 'running' });
```

Pontos importantes:

- A primeira mensagem é **sempre** o `system prompt` (vem do `CastedAgent`).
- `appendMessages` salva no storage a cada turno → resiliente a crash.
- `parentId` (opcional) liga sub-sessions criadas via `squad_route`.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- session
# ✓ SessionPool > cria sessão com system prompt do charter
```
