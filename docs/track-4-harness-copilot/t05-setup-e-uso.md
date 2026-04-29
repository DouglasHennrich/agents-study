# t05. Setup, autenticação e uso

## Instalação

```bash
cd examples/claude-mini-copilot
npm install
npm test          # 16/16 passa offline (MockProvider)
```

## Autenticação Copilot

Duas formas:

### A. Variável `COPILOT_TOKEN`

```bash
export COPILOT_TOKEN="ghu_..."   # token Copilot do seu user
```

Como obter? Há vários jeitos (extension VS Code, gh CLI auth flow). O mais portátil:

```bash
# se você já usa Copilot CLI:
gh auth token > /dev/null && echo "ok"
```

E aponte:

```bash
export COPILOT_TOKEN="$(gh auth token)"
```

### B. Passar no construtor

```ts
import { CopilotProvider } from './provider/copilot.js';
const provider = new CopilotProvider({ token: 'ghu_...', model: 'gpt-4o-mini' });
```

> **SDK v0.3+**: O `@github/copilot-sdk` v0.3+ usa sessões JSON-RPC — não mais `chat.completions.create()`. O provider deste tutorial usa `createSession()` + `sendAndWait()`. Veja `src/provider/copilot.ts`.

## Uso básico

```bash
# sem token, usa MockProvider:
npm run dev -- chat "olá"

# com token Copilot:
export COPILOT_TOKEN="$(gh auth token)"
npm run dev -- chat "liste os arquivos .ts deste projeto e me diga quantos são"
```

Saída esperada (modelo real):

```
[claude-mini-copilot] usando CopilotProvider (gpt-4o-mini)

[tool] glob({"pattern":"**/*.ts"})
[result] ["src/query.ts","src/provider/types.ts",...]

Encontrei 14 arquivos .ts no projeto: ...
[done] 2 turnos, $0.0003
```

## Modelos suportados

Depende do plano Copilot. Comuns:

| Modelo | Velocidade | Qualidade | Custo (input/output por M tokens) |
|---|---|---|---|
| `gpt-4o-mini` | ⚡ rápido | médio | $0.15 / $0.60 |
| `gpt-4o` | médio | alto | $2.50 / $10.00 |
| `claude-3-5-sonnet` (via Copilot) | médio | muito alto | varia por plano |
| `o1-preview` (se disponível) | lento | extreme | caro |

Trocar:

```bash
COPILOT_MODEL=gpt-4o npm run dev -- chat "..."
```

## Comparativo lado-a-lado

```bash
# Mesmo prompt, dois harnesses:
( cd examples/claude-mini && npm run dev -- chat "leia README.md e resuma" )
( cd examples/claude-mini-copilot && npm run dev -- chat "leia README.md e resuma" )
```

O comportamento de tool-calling pode diferir:

- Claude tende a chamar **menos tools** (decide melhor o que precisa).
- GPT-4o-mini tende a chamar **mais tools em paralelo** (até 5 por turno).
- Coordinator: GPT é mais rápido fechando tasks; Claude raciocina mais antes.

## Quando trocar de novo?

Mesmo loop, modelo diferente:

```ts
// no CLI ou script:
import { CopilotProvider } from './provider/copilot.js';
const provider = new CopilotProvider({ model: 'gpt-4o' });   // mesmo loop, modelo melhor
```

Tudo o resto (tasks/coordinator/teams) **não muda nada**.

## Limitações conhecidas

1. **Sem prompt cache** — Copilot/OpenAI não expõem `cache_control` por bloco. Em sessões longas, custos sobem.
2. **Sem extended thinking** — modelos Anthropic only.
3. **Tool-call paralelismo** — GPT-4o-mini limita ~5 tool_calls por turno; coordinator com muitos teammates pode serializar.
4. **Streaming** — implementação atual usa `stream:false` e fakeia deltas (ver [t01](t01-copilot-provider.md#por-que-não-streaming-verdadeiro)). Para SSE real, refatore o adapter.
5. **Token rotation** — `COPILOT_TOKEN` expira. Se for daemon longo, implemente refresh.

## Fim da Trilha 4

Você agora tem **dois harnesses funcionais** e a clareza de que arquitetura > LLM. Para revisitar:

- [Hub das 4 trilhas](../README.md)
- [Trilha 3 (Anthropic)](../track-3-harness/README.md)
- [`examples/claude-mini-copilot/`](../../examples/claude-mini-copilot/)

Próximos passos sugeridos:

- Implementar streaming real no `CopilotProvider`.
- Adicionar `tool_choice` para fluxos guiados (forçar `enter_plan_mode` no início).
- Comparar custo/qualidade rodando o mesmo benchmark nos dois exemplos.
- Wrappear em GitHub Action que usa `claude-mini-copilot` em PRs.

← [Voltar ao hub](../README.md)
