#!/usr/bin/env node
import { Command } from 'commander';
import * as readline from 'node:readline';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CopilotProvider } from '../client/copilot-provider.js';
import { CastingEngine } from '../casting/casting-engine.js';
import { SessionPool } from '../session/session.js';
import { FileStorage } from '../storage/file-storage.js';
import { HookPipeline } from '../hooks/pipeline.js';
import { piiScrubHook, fileWriteGuard } from '../hooks/builtin.js';
import { EventBus } from '../events/event-bus.js';
import { Ralph } from '../ralph/ralph.js';
import { Router } from '../router/router.js';
import { Runtime } from '../runtime/runtime.js';
import { VERSION } from '../index.js';
import type { Charter } from '../charter/charter.js';
import {
  orquestrarOrcamento,
  relatorioMarkdown,
  type Pedido,
} from '../orcamento/index.js';

const ROOT = '.mini-squad';

const program = new Command();
program
  .name('mini-squad')
  .description('Mini-orquestrador de agents (tutorial)')
  .version(VERSION);

program
  .command('init')
  .description('Cria estrutura .mini-squad/ com charters de exemplo')
  .action(async () => {
    await fs.mkdir(path.join(ROOT, 'charters'), { recursive: true });
    const sample: Charter = {
      name: 'Coordinator',
      role: 'coordenador genérico',
      goals: ['Atender pedidos do usuário'],
      tools: ['squad_route', 'squad_status', 'squad_decide', 'squad_memory'],
    };
    await fs.writeFile(
      path.join(ROOT, 'charters', 'Coordinator.json'),
      JSON.stringify(sample, null, 2),
    );
    console.log(`✓ ${ROOT}/charters/Coordinator.json criado`);
  });

program
  .command('agents')
  .description('Lista charters disponíveis em .mini-squad/charters/')
  .action(async () => {
    const dir = path.join(ROOT, 'charters');
    const files = await fs.readdir(dir).catch(() => []);
    if (!files.length) {
      console.log('(vazio — rode `mini-squad init`)');
      return;
    }
    for (const f of files) {
      const c = JSON.parse(
        await fs.readFile(path.join(dir, f), 'utf8'),
      ) as Charter;
      console.log(`- ${c.name}: ${c.role}`);
    }
  });

program
  .command('status')
  .description('Lista sessões persistidas')
  .action(async () => {
    const storage = new FileStorage(ROOT);
    const sessions = await storage.listSessions();
    if (!sessions.length) return console.log('(sem sessões)');
    for (const s of sessions) {
      console.log(`- ${s.id}  ${s.agentName}  ${s.status}  (${s.updatedAt})`);
    }
  });

program
  .command('run')
  .description('Roda um turno de agent: mini-squad run --agent X --input "..."')
  .requiredOption('-a, --agent <name>', 'nome do charter')
  .requiredOption('-i, --input <text>', 'prompt do usuário')
  .option('--no-ralph', 'desabilita o monitor Ralph')
  .action(async (opts) => {
    const charter = await loadCharter(opts.agent);
    const engine = new CastingEngine();
    const agent = engine.castAgent(charter);

    const bus = new EventBus();
    if (opts.ralph !== false) new Ralph(bus).start();

    const hooks = new HookPipeline()
      .register(piiScrubHook('before_llm'))
      .register(fileWriteGuard({ allow: ['docs/**', `${ROOT}/**`] }));

    const pool = new SessionPool(new FileStorage(ROOT));
    const session = await pool.create(agent);
    const runtime = new Runtime({
      llm: new CopilotProvider(),
      pool,
      hooks,
      bus,
    });
    const out = await runtime.run(agent, session, opts.input);
    console.log('\n──── resposta ────\n' + out);
  });

program
  .command('repl')
  .description('REPL interativo. Use @AgentName para alternar agente.')
  .option('-a, --agent <name>', 'agente inicial', 'Coordinator')
  .action(async (opts) => {
    const engine = new CastingEngine();
    const charter = await loadCharter(opts.agent);
    let current = engine.castAgent(charter);

    const router = new Router({
      defaultAgent: current.charter.name,
      rules: [],
    });
    const bus = new EventBus();
    const hooks = new HookPipeline().register(piiScrubHook('before_llm'));
    const pool = new SessionPool(new FileStorage(ROOT));
    let session = await pool.create(current);
    const runtime = new Runtime({
      llm: new CopilotProvider(),
      pool,
      hooks,
      bus,
    });

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(`mini-squad REPL (agente: ${current.charter.name}). Ctrl+D para sair.`);
    rl.setPrompt(`${current.charter.name}> `);
    rl.prompt();

    rl.on('line', async (raw) => {
      const line = raw.trim();
      if (!line) return rl.prompt();
      // @AgentName troca de agente
      const m = line.match(/^@(\w+)\s*(.*)$/);
      if (m) {
        const c = await loadCharter(m[1]).catch(() => null);
        if (!c) {
          console.log(`(charter ${m[1]} não encontrado)`);
          return rl.prompt();
        }
        current = engine.castAgent(c);
        session = await pool.create(current);
        rl.setPrompt(`${current.charter.name}> `);
        if (m[2]) {
          const out = await runtime.run(current, session, m[2]);
          console.log(out);
        }
        return rl.prompt();
      }
      try {
        const out = await runtime.run(current, session, line);
        console.log(out);
      } catch (err) {
        console.error('Erro:', (err as Error).message);
      }
      rl.prompt();
    });
  });

async function loadCharter(name: string): Promise<Charter> {
  const file = path.join(ROOT, 'charters', `${name}.json`);
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

program
  .command('orcar')
  .description('Gera orçamento consolidado a partir de um pedido JSON')
  .requiredOption('-p, --pedido <file>', 'arquivo JSON com o pedido')
  .requiredOption('-o, --out <file>', 'caminho do relatório Markdown de saída')
  .option('--no-ralph', 'desabilita Ralph')
  .action(async (opts) => {
    const pedido = JSON.parse(await fs.readFile(opts.pedido, 'utf8')) as Pedido;
    const bus = new EventBus();
    if (opts.ralph !== false) new Ralph(bus).start();

    const relatorio = await orquestrarOrcamento(pedido, bus);
    await fs.writeFile(opts.out, relatorioMarkdown(relatorio), 'utf8');
    console.log(`✓ relatório salvo em ${opts.out}`);
    console.log(`  total melhor cenário: R$ ${relatorio.totalMelhorCenario.toFixed(2)}`);
  });

program.parseAsync(process.argv);
