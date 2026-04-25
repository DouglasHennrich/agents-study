# 01. Ambiente e Copilot SDK

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

O agent precisa de um **provedor LLM**. Vamos usar o **GitHub Copilot SDK** (`@github/copilot-sdk`), que reusa a sua autenticação do `gh` e expõe uma API de Chat Completions com tool-calling.

## Como o Squad faz

O Squad só tem um provedor de LLM oficial: o Copilot SDK. Não há fallback para Ollama, OpenAI, Claude — a fidelidade está em usar a infra que a Microsoft/GitHub mantém para Copilot.

A autenticação acontece em duas etapas:

1. `gh auth login` — gera token OAuth de usuário.
2. O SDK lê esse token (ou a env var `COPILOT_TOKEN`) e troca por um access token de curta duração.

## Construa o seu

### 1. Instale o Node 20+

```bash
node --version   # deve mostrar v20.x ou superior
```

Se precisar instalar/atualizar, use [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 20
nvm use 20
```

### 2. Instale a `gh` CLI

macOS:

```bash
brew install gh
```

Linux/Windows: veja https://cli.github.com/.

### 3. Autentique

```bash
gh auth login
# Selecione: GitHub.com → HTTPS → Login with a web browser
```

Confirme que está logado:

```bash
gh auth status
```

### 4. (Opcional) Exporte `COPILOT_TOKEN`

Se você prefere passar o token explicitamente (útil em CI):

```bash
export COPILOT_TOKEN="$(gh auth token)"
```

> ⚠️ **Segurança**: nunca commite o token. Adicione `.env` ao `.gitignore`.

### 5. Verifique acesso ao Copilot

```bash
gh copilot --version
```

Se aparecer "command not found", instale a extensão:

```bash
gh extension install github/gh-copilot
```

## ✓ Validar

```bash
gh auth status
# ✓ Logged in to github.com as <seu-usuário>
# ✓ Token: gho_********

node --version
# v20.x.x

echo $COPILOT_TOKEN | cut -c1-4
# gho_     (ou ghu_ — mostra prefixo, não exponha o token)
```

Tudo verde? Para o próximo capítulo.
