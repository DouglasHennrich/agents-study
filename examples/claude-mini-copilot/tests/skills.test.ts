import { describe, it, expect } from 'vitest';
import { SkillLoader } from '../src/skills/loader.js';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('skills (s05)', () => {
  it('lista skills com description e carrega conteúdo', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cm-skills-'));
    await mkdir(join(dir, 'testing'));
    await writeFile(
      join(dir, 'testing', 'SKILL.md'),
      '---\nname: testing\ndescription: padrões de teste\n---\nUse vitest.\n',
    );
    const loader = new SkillLoader(dir);
    const list = await loader.list();
    expect(list).toEqual([{ name: 'testing', description: 'padrões de teste' }]);
    const content = await loader.load('testing');
    expect(content).toContain('Use vitest');
  });

  it('lista vazia se diretório não existe', async () => {
    const loader = new SkillLoader('/tmp/nonexistent-cm-skills-xyz');
    expect(await loader.list()).toEqual([]);
  });
});
