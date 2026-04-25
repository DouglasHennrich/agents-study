# s05. Skills on Demand — load via `tool_result`

> *"Carregue conhecimento quando precisar."* Em vez de inflar o system prompt com toda doc do mundo, exponha uma `skill` tool que injeta a doc só quando o modelo pede.

## Como Claude Code faz

📂 `src/tools/SkillTool/`, `src/utils/memdir/`, arquivos `CLAUDE.md` por diretório

- **`SkillTool`** — `skill(name)` retorna o conteúdo da skill como `tool_result`. O conteúdo entra no contexto **só naquele turno** (e fica nos messages[] subsequentes, mas você pode comprimir depois).
- **`CLAUDE.md` lazy loading** — quando o modelo abre `cwd/foo/`, a `CLAUDE.md` daquela pasta é carregada (se existir).
- **`memdir`** — diretório `~/.claude/memory/` com notas persistidas pelo modelo.

## Por que funciona

System prompt invariante = caro a cada turno. Skills carregadas sob demanda = pago **uma vez**, depois cacheado pelo prompt cache da Anthropic.

## Versão didática

📄 `src/skills/loader.ts`

```ts
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface SkillDef {
  name: string;
  description: string;
  path: string;
}

export class SkillLoader {
  constructor(private skillsDir: string) {}

  async list(): Promise<SkillDef[]> {
    const entries = await readdir(this.skillsDir, { withFileTypes: true });
    const skills: SkillDef[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillFile = join(this.skillsDir, e.name, 'SKILL.md');
      try {
        const content = await readFile(skillFile, 'utf-8');
        const desc = extractDescription(content) ?? '(sem descrição)';
        skills.push({ name: e.name, description: desc, path: skillFile });
      } catch { /* sem SKILL.md, pula */ }
    }
    return skills;
  }

  async load(name: string): Promise<string> {
    const path = join(this.skillsDir, name, 'SKILL.md');
    return await readFile(path, 'utf-8');
  }
}

function extractDescription(md: string): string | null {
  const m = md.match(/^description:\s*(.+)$/m);
  return m?.[1] ?? null;
}
```

## Tool

📄 `src/tools/builtin/skill.ts`

```ts
import { z } from 'zod';
import { buildTool } from '../registry.js';
import { SkillLoader } from '../../skills/loader.js';

const loader = new SkillLoader(process.env.SKILLS_DIR ?? `${process.env.HOME}/.claude-mini/skills`);

export const skillTool = buildTool({
  name: 'skill',
  description: 'Carrega uma skill (instruções especializadas) pelo nome. Use list_skills para descobrir nomes.',
  schema: z.object({ name: z.string() }),
  isReadOnly: true,
  isConcurrencySafe: true,
  async call({ name }) {
    return { name, content: await loader.load(name) };
  },
});

export const listSkillsTool = buildTool({
  name: 'list_skills',
  description: 'Lista todas as skills disponíveis e suas descrições.',
  schema: z.object({}),
  isReadOnly: true,
  isConcurrencySafe: true,
  async call() {
    const skills = await loader.list();
    return skills.map(s => `- **${s.name}**: ${s.description}`).join('\n');
  },
});
```

## System prompt: ensine quando carregar

```ts
const systemPrompt = `Você é o claude-mini.

## Skills disponíveis
Use list_skills para ver. Se a tarefa do usuário menciona um domínio específico
(testes, performance, security, API), carregue a skill correspondente ANTES de
começar — ela contém o "como fazer certo" pra esse domínio.

Não tente lembrar conhecimento — carregue a skill.`;
```

## CLAUDE.md lazy loading (opcional)

📄 `src/skills/claude-md.ts`

```ts
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export async function findClaudeMd(cwd: string): Promise<string | null> {
  let dir = cwd;
  while (dir !== dirname(dir)) {
    try {
      const content = await readFile(join(dir, 'CLAUDE.md'), 'utf-8');
      return content;
    } catch {}
    dir = dirname(dir);
  }
  return null;
}
```

E no startup do `runQuery`, prepende ao system prompt se existir:

```ts
const claudeMd = await findClaudeMd(process.cwd());
const systemPrompt = claudeMd
  ? `${baseSystemPrompt}\n\n## Project context (CLAUDE.md)\n${claudeMd}`
  : baseSystemPrompt;
```

## Anti-padrões

- ❌ Skill de 5000 linhas (vira fardo de contexto). Quebre em sub-skills.
- ❌ Skill sem `description` no frontmatter (modelo nunca chama).
- ❌ `CLAUDE.md` em **toda** pasta (gera ruído). Use só onde regras locais variam.
- ❌ Carregar skill **proativamente** no system prompt (anula o benefício).

## ✓ Validar

```bash
mkdir -p ~/.claude-mini/skills/testing
cat > ~/.claude-mini/skills/testing/SKILL.md <<'EOF'
---
name: testing
description: Padrões de teste com Vitest neste projeto
---
Use vitest, AAA pattern, sem mocks de bibliotecas.
EOF

npm run dev -- chat "Como escrevo testes neste projeto?"
# Modelo deve chamar list_skills, depois skill(name="testing").
```

## Próximo

→ [s06. Context Compression — 3 estratégias](s06-context-compression.md)
