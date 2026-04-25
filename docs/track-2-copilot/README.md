# Trilha 2 — Copilot CLI (`copilot --agent mini-squad`)

> Aprenda a transformar o **GitHub Copilot CLI** em um orquestrador multi-agent custom — sem reinventar transport, auth ou loop ReAct. O Copilot já fala com o LLM; você só fornece **contexto + tools + regras**.

## Por que esta trilha existe

Na [Trilha 1](../track-1-sdk/README.md) construímos `mini-squad` como um binário **standalone** que chama o Copilot SDK direto. Mas o **Squad real** ([bradygaster/squad](https://github.com/bradygaster/squad)) faz diferente: ele roda **dentro** do Copilot CLI como um *custom agent*.

Esta trilha mostra o caminho real, com o **mesmo** mini-squad servindo de "back-end" de tools.

```mermaid
sequenceDiagram
  participant U as Você
  participant CCLI as copilot CLI
  participant API as api.githubcopilot.com
  participant MS as mini-squad (CLI local)
  participant FS as .copilot/agents + .squad/

  U->>CCLI: copilot --agent mini-squad --yolo
  CCLI->>FS: lê mini-squad.md (system prompt + tools)
  loop por turno
    U->>CCLI: prompt
    CCLI->>API: POST /chat/completions (Bearer copilot-token)
    API-->>CCLI: tool_call mini_squad_orcar(...)
    CCLI->>MS: npx tsx src/cli/index.ts orcar ...
    MS-->>CCLI: stdout (resultado/path)
    CCLI->>API: POST /chat/completions (tool_result)
    API-->>CCLI: assistant final
    CCLI-->>U: resposta
  end
```

> **TL;DR:** o Copilot CLI é o **runtime LLM**, o mini-squad é o **conjunto de tools**, e o `.md` no `.copilot/agents/` é o **contrato entre os dois**.

## Roadmap

```mermaid
flowchart LR
  C1[01<br/>Conceitos] --> C2[02<br/>Setup]
  C2 --> C3[03<br/>Anatomia<br/>do agent .md]
  C3 --> C4[04<br/>Tools custom]
  C4 --> C5[05<br/>Slash commands]
  C5 --> C6[06<br/>Hooks &<br/>permissions]
  C6 --> C7[07<br/>Watch mode<br/>+ issues]
  C7 --> C8[08<br/>Distribuir<br/>e versionar]
```

## Índice

1. [Conceitos: Squad real vs. mini-squad](01-conceitos-squad-real-vs-mini-squad.md)
2. [Setup: instalar Copilot CLI + autenticar](02-setup-copilot-cli.md)
3. [Anatomia de um agent `.md` (frontmatter + system prompt)](03-anatomia-agent-md.md)
4. [Tools custom: expor seus comandos como function-calls](04-tools-custom.md)
5. [Slash commands custom (`/orcar`, `/status`)](05-slash-commands-custom.md)
6. [Hooks & permissions: gates antes/depois das tools](06-hooks-e-permissions.md)
7. [Watch mode caseiro: triagem de issues GitHub](07-watch-mode-issues.md)
8. [Distribuir, versionar e debugar seu agent](08-distribuir-e-debugar.md)

## Pré-requisitos

| Item | Como obter |
|---|---|
| Node.js 20+ | [nodejs.org](https://nodejs.org) ou `nvm` |
| `gh` CLI autenticado | `brew install gh && gh auth login` |
| Copilot CLI | `gh extension install github/gh-copilot` **ou** `npm i -g @github/copilot` |
| Acesso ao GitHub Copilot | conta paga ou trial |
| Mini-squad rodando | seguir [Trilha 1 §02](../track-1-sdk/01-setup/02-projeto-mini-squad.md) |

> Não precisa terminar a Trilha 1 inteira. Só basta ter `examples/mini-squad/` com `npm install` feito e `npx tsx src/cli/index.ts status` funcionando.

## ✓ Resultado final esperado

Ao fim desta trilha você terá:

1. Um `.copilot/agents/mini-squad.md` completo com 5+ tools, hooks de validação e slash commands.
2. Capacidade de rodar `copilot --agent mini-squad --yolo` e ter um chat orquestrando os 4 sub-agents do mini-squad.
3. Um script de **watch mode** que escuta issues do GitHub com label `orcamento` e responde com relatórios automáticos via Copilot.
4. Versionamento e troubleshooting do agent (`copilot --list-agents`, logs verbosos, dry-run de tools).

## Próximo

→ [01. Conceitos: Squad real vs. mini-squad](01-conceitos-squad-real-vs-mini-squad.md)
