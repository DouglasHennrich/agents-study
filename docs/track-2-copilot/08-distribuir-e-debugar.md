# 08. Distribuir, versionar e debugar seu agent

> Como compartilhar o `mini-squad.md` com o time, manter mudanças sob controle, e descobrir o que está acontecendo quando o agent não se comporta.

## Distribuir — 3 níveis

| Escopo | Path | Quando usar |
|---|---|---|
| **Projeto** | `<repo>/.copilot/agents/<nome>.md` | Agent acoplado ao repo (versionado em git) |
| **Org** | `<repo>/.github/copilot/agents/<nome>.md` | Agent disparado por workflows do org |
| **Usuário** | `~/.copilot/agents/<nome>.md` | Atalhos pessoais cross-projects |

### Para o time (recomendado)

```bash
git add .copilot/agents/mini-squad.md scripts/
git commit -m "feat(agent): adiciona mini-squad como custom agent do Copilot CLI"
git push
```

Quem clonar o repo e tiver o `copilot` instalado vê:

```bash
copilot --list-agents
# mini-squad   Orquestrador multi-agent didático
```

### Para você cross-project

```bash
ln -s "$PWD/examples/mini-squad/.copilot/agents/mini-squad.md" \
      ~/.copilot/agents/mini-squad-global.md
```

(Renomeie pra evitar conflito com o local.)

## Versionar com cabeçalho

Adicione metadados no body para ser rastreável:

```markdown
---
name: mini-squad
description: ...
version: 1.2.0
maintainers: ["@douglashennrich"]
changelog_url: ./CHANGELOG.md
---

<!--
  v1.2.0 — 2026-04-24
    - Adiciona slash command /explicar
    - Hook pre_tool_use com validação de JSON
  v1.1.0 — 2026-04-20
    - Tool mini_squad_run para debug
  v1.0.0 — 2026-04-15
    - Lançamento inicial
-->

Você é o Mini-Squad Orchestrator...
```

Mantenha um `CHANGELOG.md` ao lado se a coisa crescer.

## Smoke test em CI

📄 `.github/workflows/agent-smoke.yml`

```yaml
name: Agent smoke test
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - working-directory: examples/mini-squad
        run: |
          npm ci
          # Sintaxe do .md
          npx js-yaml .copilot/agents/mini-squad.md > /dev/null
          # Tools listadas existem como subcomandos do CLI
          for tool in mini_squad_orcar mini_squad_status mini_squad_run; do
            sub="${tool#mini_squad_}"
            npx tsx src/cli/index.ts "$sub" --help > /dev/null \
              || { echo "❌ subcomando $sub não responde"; exit 1; }
          done
          echo "✓ agent smoke ok"
```

## Debug — ferramentas que você tem

### 1. Verbose mode

```bash
copilot --agent mini-squad --verbose -p "..."
```

Mostra: system prompt montado, tool_calls emitidos, args, durations.

Se sua versão não suporta `--verbose`:

```bash
COPILOT_LOG_LEVEL=debug copilot --agent mini-squad -p "..."
```

### 2. Logs do CLI

```bash
ls -la ~/.copilot/logs/
tail -f ~/.copilot/logs/$(date +%Y-%m-%d).log
```

### 3. Dry-run das tools

Antes de invocar pelo agent, valide o command no shell:

```bash
# substitua manualmente as vars
npx tsx src/cli/index.ts orcar -p examples-app/pedido.json -o /tmp/o.md --no-ralph
```

### 4. Inspecionar tool_calls emitidos

Adicione um wrapper que loga:

```bash
# scripts/log-and-run.sh
#!/usr/bin/env bash
echo "[$(date +%H:%M:%S)] $@" >> /tmp/mini-squad-tools.log
exec "$@"
```

E no agent:

```yaml
tools:
  - name: mini_squad_orcar
    command: ./scripts/log-and-run.sh npx tsx src/cli/index.ts orcar -p {{pedido_path}} -o {{output_path}}
```

`tail -f /tmp/mini-squad-tools.log` mostra cada chamada.

## Sintomas → causas comuns

| Sintoma | Causa provável | Fix |
|---|---|---|
| `unknown agent: mini-squad` | path errado | `copilot --agents-dir .copilot/agents --list-agents` |
| Modelo nunca chama a tool | `description` fraca ou ambígua | reescreva com verbo + quando usar |
| Modelo loopa chamando a mesma tool | falta condição de parada no system prompt | adicione "após X, **pare**" |
| Tool roda mas modelo ignora resultado | stdout vazio / só "OK" | retorne info útil + próximas ações |
| Permission denied no shell | hook ou `always_deny` ativo | `copilot --verbose` mostra qual regra negou |
| Resposta lenta | `tsx` boot a cada chamada | `npm run build` + apontar pra `dist/` |
| `fetch failed` mid-session | token expirou | `gh auth refresh -h github.com -s copilot` |
| Agent "esquece" tools custom | YAML inválido (silencioso em algumas versões) | `npx js-yaml mini-squad.md` |

## Performance — quando importa

Hot path: `npx tsx` é ~200-500ms só pra subir. Se o agent chama a tool 5+ vezes por turno:

```bash
cd examples/mini-squad
npm run build
```

Depois aponta as tools pro `dist/`:

```yaml
tools:
  - name: mini_squad_orcar
    command: node dist/cli/index.js orcar -p {{pedido_path}} -o {{output_path}} --no-ralph
```

Reduz pra ~50ms.

## Compartilhamento como pacote npm (avançado)

Se você quer publicar `@meu-org/mini-squad-agent`:

```
mini-squad-agent/
├── package.json          # bin: { mini-squad: "./dist/cli/index.js" }
├── agents/
│   └── mini-squad.md
└── postinstall.js        # link agents/* em ~/.copilot/agents/
```

`postinstall.js`:

```js
import { copyFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
const dest = join(homedir(), '.copilot/agents/mini-squad.md');
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(new URL('./agents/mini-squad.md', import.meta.url), dest);
console.log('✓ mini-squad agent instalado em', dest);
```

`npm i -g @meu-org/mini-squad-agent` deixa o agent disponível globalmente.

## ✓ Validar

```bash
# 1. Time consegue listar
git pull && copilot --list-agents | grep mini-squad

# 2. Smoke roda local
cd examples/mini-squad
copilot --agent mini-squad -p "/status"

# 3. Tools tracked
tail /tmp/mini-squad-tools.log
```

## Fim da Trilha 2 🎉

Você agora consegue:

- ✅ Definir agents custom (`.md`) que o Copilot CLI carrega
- ✅ Expor seu mini-squad como conjunto de tools function-callable
- ✅ Adicionar slash commands de domínio
- ✅ Aplicar hooks/permissions sem mexer no loop ReAct (porque ele nem é seu)
- ✅ Disparar o agent via watch mode em issues / GitHub Actions
- ✅ Versionar e debugar quando algo dá errado

## Para onde ir agora

- **Quer entender como o Copilot CLI faz tudo isso por dentro?** → [Trilha 3](../track-3-harness/README.md). Lá você constrói uma versão didática do harness do Claude Code, que tem **arquitetura quase idêntica** à do Copilot CLI internamente.
- **Quer reaproveitar a `HookPipeline` em modo standalone também?** → [Trilha 1 §07](../track-1-sdk/07-governance/01-hook-pipeline.md).
