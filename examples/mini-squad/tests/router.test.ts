import { describe, it, expect } from 'vitest';
import { Router, compileRoutingRules, matchRoute } from '../src/router/router.js';
import { CastingEngine } from '../src/casting/casting-engine.js';

describe('Router', () => {
  it('roteia pela primeira regra que casa', () => {
    const r = new Router({
      defaultAgent: 'Coordinator',
      rules: [
        { match: /or[cç]amento/i, agent: 'Coordinator' },
        { match: /clima|tempo/i, agent: 'WeatherAgent' },
      ],
    });
    expect(r.route('quero um orçamento')).toBe('Coordinator');
    expect(r.route('como está o tempo?')).toBe('WeatherAgent');
    expect(r.route('me conte uma piada')).toBe('Coordinator'); // fallback
  });

  it('respeita prioridade', () => {
    const compiled = compileRoutingRules([
      { match: /api/i, agent: 'A', priority: 1 },
      { match: /api/i, agent: 'B', priority: 5 },
    ]);
    expect(matchRoute('quero usar a API', compiled, 'X')).toBe('B');
  });
});

describe('CastingEngine', () => {
  it('monta agent só com as tools permitidas pelo charter', () => {
    const eng = new CastingEngine();
    const a = eng.castAgent({
      name: 'OnlyMemory',
      role: 'guarda lembranças',
      tools: ['squad_memory'],
    });
    expect(a.registry.list().map((t) => t.name)).toEqual(['squad_memory']);
    expect(a.systemPrompt).toContain('OnlyMemory');
  });

  it('falha se charter pede tool inexistente', () => {
    const eng = new CastingEngine();
    expect(() =>
      eng.castAgent({
        name: 'X',
        role: '',
        tools: ['ferramenta_inexistente'],
      }),
    ).toThrow(/não disponível/);
  });
});
