# 03. CastingEngine

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

O **CastingEngine** transforma um Charter (definição) em um **CastedAgent** (instância pronta), ligando:

- `systemPrompt` renderizado.
- `ToolRegistry` filtrado pelas tools permitidas.
- Hooks que serão aplicados (Phase 8).

É o ponto onde **identidade vira capacidade**.

## Como o Squad faz

Em `packages/squad-sdk/src/casting/` o Squad mantém:

- Um pool de tools globais.
- Um cast persistido (registry de agents já "elencados") — para conversas reentrantes.
- Conceito de **universos temáticos** (você pode trocar a `persona` de todos os agents para ficção, p.ex.). No tutorial, ignoramos universos para focar na mecânica.

## Construa o seu

Veja [`src/casting/casting-engine.ts`](../../examples/mini-squad/src/casting/casting-engine.ts).

```ts
const eng = new CastingEngine();
const coord = eng.castAgent(Coordinator);

coord.systemPrompt;       // string pronta
coord.registry.list();    // só as tools permitidas
coord.registry.schemas(); // formato Copilot
```

Por que filtrar tools por charter:

- **Princípio do menor privilégio** — `WeatherAgent` não deveria conseguir gravar arquivos.
- **Prompt menor** — menos schemas no contexto = mais tokens para a tarefa.
- **Erros mais cedo** — `castAgent` falha no boot se você esqueceu de registrar uma tool.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- router
# ✓ CastingEngine > monta agent só com as tools permitidas pelo charter
# ✓ CastingEngine > falha se charter pede tool inexistente
```
