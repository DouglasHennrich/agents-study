import dotenv from 'dotenv';
dotenv.config();

import { CopilotProvider } from '../client/index.js';

const llm = new CopilotProvider({ model: 'gpt-4.1' });

for await (const chunk of llm.stream({
  model: 'gpt-4.1',
  messages: [{
    role: 'user',
    content: 'Escreva um ensaio detalhado de pelo menos 500 palavras explicando como funciona a internet, desde o momento em que o usuário digita uma URL no navegador até a página aparecer na tela. Inclua detalhes sobre DNS, TCP/IP, HTTP, servidores web e renderização do HTML.',
  }],
})) {
  if (chunk.delta) {
    process.stdout.write(chunk.delta);
  }
  if (chunk.finishReason) console.log('\n[fim:', chunk.finishReason, ']');
}

process.exit();