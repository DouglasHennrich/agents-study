import dotenv from 'dotenv';
dotenv.config();

import { CopilotProvider } from '../client/index.js';

const llm = new CopilotProvider({ model: 'gpt-4.1' });

const res = await llm.chat({
  messages: [
    { role: 'system', content: 'Você é um assistente conciso em PT-BR.' },
    { role: 'user', content: 'quais são os modelos de LLM suportado pelo Github Copilot?' },
  ],
});

console.log(res.message.content);

process.exit();