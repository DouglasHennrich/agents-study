# t03. Tools no formato OpenAI function-calling

## O que muda em `toSpecs()`

Anthropic (T3):

```jsonc
{
  "name": "bash",
  "description": "...",
  "input_schema": { "type": "object", "properties": { ... } }
}
```

OpenAI/Copilot (T4):

```jsonc
{
  "type": "function",
  "function": {
    "name": "bash",
    "description": "...",
    "parameters": { "type": "object", "properties": { ... } }
  }
}
```

Apenas o **wrapping** muda. O JSON Schema interno é igual.

## Registry adaptado

📄 `src/tools/registry.ts` (extrato — só o que muda)

```ts
export class ToolRegistry {
  // ... resto idêntico ao claude-mini ...

  toSpecs() {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.schema),
    }));
  }
}
```

> Nota: aqui devolvemos só `{name, description, parameters}` — o **wrapping `{type:"function", function:{...}}`** fica no `CopilotProvider` (capítulo t01). Isso mantém o registry agnóstico ao provider.

## Tools que continuam idênticas

Todas as tools de `src/tools/builtin.ts` do `claude-mini` funcionam **sem mudança**. Por quê?

```ts
buildTool({
  name: 'bash',
  description: '...',
  schema: z.object({ command: z.string(), timeout_ms: z.number().int().positive().default(30_000) }),
  isDestructive: true,
  async call({ command, timeout_ms }, ctx) { /* ... */ },
});
```

A `buildTool` só conhece **Zod**. A serialização para o formato do LLM é responsabilidade do registry. Trocar de Anthropic para Copilot **não toca em nenhuma tool**.

## Cuidado com `additionalProperties`

OpenAI function-calling é **mais estrito** que o da Anthropic com modos `strict: true`. Se você ativar:

```ts
tools: req.tools.map((t) => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.parameters, strict: true },
}))
```

Você precisa garantir:

- `additionalProperties: false` no schema raiz.
- Todos os campos em `required` (sem optional).
- Sem `default` na raiz.

Para a versão didática, **deixe `strict: false`** (default). Você ganha flexibilidade nas tools com optional/default.

## Tool descriptions

O modelo Copilot/GPT é **mais sensível à clareza** do `description` que o Claude. Algumas dicas:

| ✅ Bom | ❌ Ruim |
|---|---|
| `"Lê conteúdo de arquivo de texto. Use antes de editar."` | `"Lê arquivo"` |
| `"Executa shell. Output limitado a 30KB. Use para builds, testes, scripts."` | `"shell"` |
| `"Lista arquivos por glob. Pattern relativo ao cwd."` | `"glob"` |

Inclua **quando usar** e **limites** — reduz tool-call errado.

## Forçando tool específica

Com SDK v0.3+, o controle de qual tool chamar é feito via system message ou prompt — não há parâmetro equivalente a `tool_choice` na API de sessões. Para forçar uma tool específica, instrua o modelo diretamente:

```ts
const session = await client.createSession({
  model: 'gpt-4o-mini',
  onPermissionRequest: approveAll,
  systemMessage: {
    content: 'Sempre use a tool `enter_plan_mode` antes de qualquer outra ação.',
  },
});
```

No `claude-mini-copilot` deixamos o modelo decidir qual tool usar.

## Próximo

→ [t04. Reaproveitando os 12 mecanismos](t04-reaproveitando-mecanismos.md)
