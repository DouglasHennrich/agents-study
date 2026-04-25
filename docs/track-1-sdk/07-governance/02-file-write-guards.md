# 02. File-write guards

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Agents que podem escrever em qualquer lugar do disco são uma **bomba-relógio**. A defesa: declarar uma **allowlist de paths** (glob) e bloquear o resto.

## Como o Squad faz

O Squad usa [picomatch](https://github.com/micromatch/picomatch) para casar paths contra patterns como `docs/**` ou `src/components/*.tsx`. Hooks `before_tool` interceptam tools de escrita e negam paths fora da allowlist.

## Construa o seu

Veja `fileWriteGuard` em [`src/hooks/builtin.ts`](../../examples/mini-squad/src/hooks/builtin.ts):

```ts
fileWriteGuard({
  allow: ['docs/**', 'examples/**/*.md'],
  writeToolNames: ['fs_write', 'write_file'],
});
```

### Pegadinhas

- **Path traversal**: `docs/../etc/passwd` casa `docs/**`? Não — `picomatch` não normaliza `..`. Sempre **normalize com `path.normalize()`** antes de testar.
- **Symlinks**: idem — `realpath` antes do match.
- **Erros didáticos**: o `reason` retornado vai para o LLM como tool message; ele entende e tenta de novo com path correto.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- hooks
# Inclui os dois testes de allow/deny.
```
