# 03. PII scrub

> **Conceito → Como o Squad faz → Construa o seu → ✓ Validar**

## Conceito

LLMs como o Copilot rodam em servidores remotos. CPF, email, telefone do seu usuário **não devem vazar** se a tarefa não exige. Hook `before_llm` mascara antes de enviar.

## Como o Squad faz

Hook configurável com listas de regex e tokens de substituição (`[CPF]`, `[EMAIL]`, etc.). Aplicado por padrão em ambientes de produção; em dev pode ser desligado.

## Construa o seu

`piiScrubHook` em [`src/hooks/builtin.ts`](../../examples/mini-squad/src/hooks/builtin.ts) cobre 3 padrões básicos:

- **CPF**: `\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b`
- **Email**: `[\w.+-]+@[\w-]+\.[\w.-]+`
- **Telefone BR**: `\(?\d{2}\)?\s?9?\d{4}-?\d{4}`

Pode ser aplicado em `before_llm` (limpa o input enviado ao modelo) **ou** em `after_tool` (limpa output de tools antes de devolver ao LLM).

> ⚠️ Regex é **first line of defense**, não única. Para regulado (LGPD, HIPAA), combine com um detector estatístico (presidio, etc.) e auditoria human-in-the-loop.

## ✓ Validar

```bash
cd examples/mini-squad
npm test -- hooks
# ✓ piiScrubHook > mascara CPF/email/telefone em mensagens before_llm
```
