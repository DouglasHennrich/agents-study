# 01. Construindo uma CLI

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

Sem uma CLI, o orquestrador é uma biblioteca acadêmica. A CLI é onde **usuário + Runtime + Storage + EventBus** se encontram. Comandos clássicos:

| Comando | Faz |
|---|---|
| `init` | cria `.mini-squad/charters/` e arquivos de exemplo |
| `agents` | lista charters |
| `run --agent X --input "..."` | roda 1 turno |
| `repl` | conversa interativa, troca agente com `@Nome` |
| `status` | lista sessões persistidas |
| `resume <id>` | (exercício) continua sessão |

## Como o Squad faz

`packages/squad-cli/` usa `commander` + um REPL custom. Comandos meta (que começam com `/`) configuram a sessão (`/model`, `/save`). Mensagens normais vão para o agent atual; `@Nome ...` rotela.

## Construa o seu

Veja [`src/cli/index.ts`](../../examples/mini-squad/src/cli/index.ts).

```bash
cd examples/mini-squad
npm run build
npm link        # registra o binário `mini-squad`

mini-squad init
mini-squad agents
mini-squad run --agent Coordinator --input "Olá! Quem é você?"
mini-squad status
mini-squad repl
```

Dentro do REPL:

```
Coordinator> me liste 3 países
... resposta ...
Coordinator> @WeatherAgent qual o clima em SP?   # troca de agente
WeatherAgent> ... resposta ...
```

### Pontos didáticos

- `commander` cobre flags/opts/help automaticamente.
- `readline` para REPL é built-in — sem dependência extra.
- A CLI só **monta** Runtime/Pool/Hooks; toda a lógica vive na SDK. Isso é Clean Architecture aplicada.

## ✓ Validar

```bash
mini-squad --version
# 0.1.0

mini-squad init
# ✓ .mini-squad/charters/Coordinator.json criado

mini-squad agents
# - Coordinator: coordenador genérico

# (requer COPILOT_TOKEN)
mini-squad run --agent Coordinator --input "diga oi em 1 frase" --no-ralph
```
