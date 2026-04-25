// Skill loader (s05)
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface SkillDef { name: string; description: string }

export class SkillLoader {
  constructor(public skillsDir: string) {}

  async list(): Promise<SkillDef[]> {
    let entries;
    try { entries = await readdir(this.skillsDir, { withFileTypes: true }); }
    catch { return []; }
    const out: SkillDef[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        const md = await readFile(join(this.skillsDir, e.name, 'SKILL.md'), 'utf-8');
        const desc = /^description:\s*(.+)$/m.exec(md)?.[1] ?? '(sem descrição)';
        out.push({ name: e.name, description: desc });
      } catch { /* sem SKILL.md */ }
    }
    return out;
  }

  async load(name: string): Promise<string> {
    return await readFile(join(this.skillsDir, name, 'SKILL.md'), 'utf-8');
  }
}
