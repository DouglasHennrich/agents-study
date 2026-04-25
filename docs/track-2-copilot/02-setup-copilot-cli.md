# 02. Setup — Copilot CLI + autenticação

> Em ~5 minutos: ter `copilot --version` funcionando e o mini-squad pronto pra ser invocado.

## 1. Instalar `gh` (GitHub CLI)

```bash
# macOS
brew install gh

# Ubuntu/Debian
sudo apt install gh

# Windows
winget install --id GitHub.cli

# Verificar
gh --version
```

## 2. Autenticar

```bash
gh auth login
# Selecione: GitHub.com → HTTPS → Login with a web browser
```

Ao final, valide:

```bash
gh auth status
# ✓ Logged in to github.com as <user> (...)
```

> O token é gravado em `~/.config/gh/hosts.yml`. **Nunca commite isso.**

## 3. Instalar o Copilot CLI

Existem **duas distribuições oficiais**. Escolha **uma**:

### Opção A — Extensão do `gh` (mais comum)

```bash
gh extension install github/gh-copilot
gh copilot --version
# Invocação: gh copilot suggest "..."
```

### Opção B — Binário standalone (preview, mais features de "agent")

```bash
npm install -g @github/copilot
copilot --version
# Invocação: copilot ...
```

> **Nesta trilha usamos a Opção B** (`copilot` standalone) porque o suporte a `--agent <nome>` e custom agents é mais maduro lá. Se você só tem a Opção A, alguns comandos serão `gh copilot ...` em vez de `copilot ...` — substitua mentalmente.

## 4. Verificar acesso ao Copilot

```bash
gh copilot suggest "list files modified today"
# ou
copilot -p "Olá, você consegue me ouvir?"
```

Se receber uma resposta do modelo, o transport está funcionando.

### Erros comuns

| Erro | Causa | Fix |
|---|---|---|
| `You do not have access to GitHub Copilot` | Conta sem assinatura | Ative trial em [github.com/settings/copilot](https://github.com/settings/copilot) |
| `gh: command not found` | gh não instalado | passo 1 |
| `401 Unauthorized` | Token expirou | `gh auth refresh -h github.com -s copilot` |
| `fetch failed` ao primeiro turno | Falta scope do Copilot | `gh auth refresh -h github.com -s copilot` |

## 5. Garantir que o mini-squad roda

```bash
cd examples/mini-squad
npm install        # se ainda não fez
npm run build      # deve passar verde
npx tsx src/cli/index.ts status
```

Saída esperada:

```
Agents disponíveis: 4
  Coordinator    (tools: squad_route, squad_decide, ...)
  WebAgentA      (tools: cotar_web_a)
  WebAgentB      (tools: cotar_web_b)
  DesktopAgent   (tools: cotar_desktop)
Sessions ativas: 0
```

## 6. Criar o diretório de agents

O Copilot CLI procura agents em (ordem):

1. `.copilot/agents/<nome>.md` (raiz do projeto atual)
2. `.github/copilot/agents/<nome>.md`
3. `~/.copilot/agents/<nome>.md` (global por usuário)

Vamos usar a **opção 1** (escopo do projeto):

```bash
cd examples/mini-squad
mkdir -p .copilot/agents
ls .copilot/agents/
# (já deve ter mini-squad.md, criado na seção de bônus anterior)
```

Se não tiver, **não se preocupe** — o próximo capítulo cria do zero.

## ✓ Validar

```bash
cd examples/mini-squad

# 1. CLI presente
copilot --version

# 2. Login OK
gh auth status

# 3. Mini-squad funcional
npx tsx src/cli/index.ts status

# 4. Diretório de agents existe
ls -la .copilot/agents/
```

Tudo verde → próximo capítulo.

## Próximo

→ [03. Anatomia de um agent `.md`](03-anatomia-agent-md.md)
