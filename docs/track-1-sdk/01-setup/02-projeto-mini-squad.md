# 02. Projeto mini-squad

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Antes de chamar o LLM, precisamos de um projeto TypeScript ESM bem-configurado, com tipos estritos, build (`tsc`) e testes (`vitest`). Esse é o esqueleto que cresce a cada Phase.

## Como o Squad faz

O Squad é um monorepo `pnpm` com:

- `packages/squad-sdk/` — biblioteca pública.
- `packages/squad-cli/` — CLI consumindo a SDK.
- `packages/squad-core/` — tipos compartilhados.

Para o tutorial, simplificamos para **um único pacote** em `examples/mini-squad/`. As pastas internas espelham os módulos do Squad SDK.

## Construa o seu

> Os arquivos abaixo já existem em [`examples/mini-squad/`](../../examples/mini-squad/) — basta instalar dependências.

Estrutura inicial:

```
examples/mini-squad/
├── package.json          # ESM + scripts build/test/dev
├── tsconfig.json         # strict, ES2022, outDir dist/
├── vitest.config.ts
├── .gitignore
└── src/
    └── index.ts          # placeholder (será expandido)
```

### `package.json` — pontos importantes

- `"type": "module"` — ESM nativo.
- `bin.mini-squad` — CLI registrável (`npm link` ou `npx`).
- Dependências:
  - `@github/copilot-sdk` — provedor LLM (Phase 3).
  - `commander` — CLI (Phase 10).
  - `zod` — validação de schemas (Phase 4).
  - `picomatch` — file-write guards (Phase 8).
- Dev: `tsx`, `typescript`, `vitest`.

### Instale e compile

```bash
cd examples/mini-squad
npm install
npm run build
```

> ⚠️ **Sobre `@github/copilot-sdk`**: o nome exato e a versão pública do SDK podem variar. Se a instalação falhar, ajuste para o pacote/versão equivalente disponível na sua organização (alguns ambientes usam `@github/copilot` ou um pacote interno). O capítulo 03 mostra a interface esperada — qualquer SDK compatível com **OpenAI Chat Completions + tool-calling** funciona com pequenas adaptações no `src/client/`.

## ✓ Validar

```bash
cd examples/mini-squad
npm install
npm run build
ls dist/
# index.js  index.js.map  index.d.ts
npm test
# (sem testes ainda — Vitest reporta "No test files found")
```

Build verde? Pronto para a Phase 3.
