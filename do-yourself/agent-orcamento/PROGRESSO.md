# Progresso — agent-orcamento

**Projeto:** `do-yourself/agent-orcamento/`  
**Branch:** `feat/agent-orcamento`  
**Última atualização:** 2026-06-06

---

## Status geral das tarefas

| # | Tarefa | Status | Notas |
|---|--------|--------|-------|
| 0–10 | Core (order, quantity, db, resolver, orchestrator, etc.) | ✅ Concluído | Testes passando |
| 11 | Auto America driver (live mapping) | ✅ Concluído | Ver detalhes abaixo |
| 12 | Roberlo driver (live mapping) | ⏳ Pendente | Próxima tarefa |
| 13 | Product resolver | ✅ Concluído | |
| 14 | Orchestrator | ✅ Concluído | |
| 15 | CLI `run` command | ⏳ Pendente | |
| 16 | Full verification (`pnpm test && pnpm build && pnpm lint`) | ⏳ Pendente | |

---

## Task 11 — Auto America driver ✅

**Arquivo criado:** `src/platforms/autoamerica-driver.ts`

### Mapeamento de campos (resultado do live mapping com browser headed)

**Cabeçalho do orçamento:**
- Cliente: `CJ_CLIENTE` (select2, 516 opções, value = CNPJ sem máscara + "0001")
  - Ex: CNPJ "028766370" → option value "0287663700001"
- Tipo de Orçamento: `CJ_XTPORC` (value `3` = Em elaboração)
- Tabela de Preços: `CJ_TABELA` (value `099` = POLIMENTO C5_12% SP-RS-MG-RJ)
- Tipo de Frete: `CJ_TPFRETE` (value `C` = CIF)
- Transportadora: `CJ_XTRANSP` (value `000157` = EXPRESSO SAO MIGUEL LTDA)
- Condição de Pagamento: `CJ_CONDPAG` (value `031` = 30/60 | `032` = 30/60/90)
  - Modalidade sempre BOLETO BANCARIO (padrão — não alterar)

**Itens (padrão NN = 2 dígitos: 01, 02, ...):**
- Produto: `CK_PRODUTO{NN}` (select2, **280 opções pré-carregadas** — set via jQuery val)
- Quantidade: `CK_QTDVEN{NN}` (text input, enabled)
- Preço c/ impostos (unit): `CK_XPRCIMP{NN}` (disabled, calculado)
- Desconto %: `CK_DESCONT{NN}` (disabled no HTML → precisa `removeAttribute('disabled')`)
- Total da linha: `CK_VALOR{NN}` (disabled)

**Totais:**
- Total do pedido: `TOTAL_ORC` (disabled input — referência para regras de mínimo e parcelas)

**Botões:**
- Novo Item: `btAddItm` (click via JS)
- Salvar: `btSalvar` (click via JS)

**Função de recálculo:** `VldValor('NN')` — deve ser chamada após setar qty ou discount.

### Roteiro completo
Ver `resources/auto-america-roteiro.md` para snippets JS detalhados.

---

## Task 12 — Roberlo driver ⏳

**Arquivo a criar:** `src/platforms/roberlo-driver.ts`

**O que precisa ser mapeado (com browser headed):**
- URL de login
- Formulário de novo orçamento (Tipo = "Previsto")
- Busca de produto (bootstrap-select — diferente do select2 do AA)
- Campo de quantidade
- Campos de desconto (Desconto 02 → Desconto 03 como fallback)
- Campo de total
- Transportadora TRANS-FACE
- Condição de pagamento (30/60/90)
- Botão salvar

**Credenciais:** `.env` → `ROBERLO_USER` / `ROBERLO_PASS`

---

## Task 15 — CLI `run` command ⏳

**Arquivo a criar:** `src/cli/index.ts`

```
agent-orcamento run --platform <autoamerica|roberlo> --order ./pedido.json
```

- Carregar .env (dotenv)
- Parsear order JSON (parseOrder)
- Instanciar AliasRepository (caminho do DB)
- Instanciar ConsolePrompter
- Instanciar driver correto (AutoAmericaDriver ou RoberloDriver)
- Chamar runOrcamento(...)

---

## Task 16 — Full verification ⏳

```bash
pnpm test        # vitest — todos os testes co-localizados em src/
pnpm build       # tsc — build ESM
pnpm lint        # eslint
```

Possíveis ajustes necessários:
- Tipos TypeScript no driver (exactOptionalPropertyTypes)
- Import paths com `.js` extension

---

## Erros conhecidos / correções anteriores

1. **Test file no diretório errado** (task 1): arquivo de test foi criado em `tests/` em vez de `src/` (co-localizado). Corrigido movendo para `src/orcamento/order.test.ts` e atualizando vitest.config.ts.

2. **vi.fn() type inference** (task 13): `vi.fn().mockResolvedValueOnce(null)` inferia `undefined` mas o tipo esperava `ProductOption | null`. Corrigido com cast explícito `as ProductOption | null`.

3. **exactOptionalPropertyTypes** (task 14): `tabelaPrecos: platform.tabelaPrecos` (string|undefined) não era atribuível a propriedade opcional. Corrigido com spread condicional: `...(platform.tabelaPrecos !== undefined ? { tabelaPrecos: platform.tabelaPrecos } : {})`.

4. **Refs mudam após fechar/reabrir browser**: Após `--headed`, refs do snapshot mudam. Sempre re-snapshot antes de usar refs.

---

## Próximos passos (continuar de outra sessão)

1. **Abrir o browser headed** para o portal Roberlo e mapear o formulário (Task 12).
   - Credenciais em `.env` como `ROBERLO_USER` e `ROBERLO_PASS`
   - Usar `agent-browser` com flag `--headed`
   - Se elemento não encontrado: PARAR e perguntar ao usuário (nunca fazer loop)

2. **Implementar `src/platforms/roberlo-driver.ts`** com base no mapeamento.
   - Desconto é lido do portal (Desconto 02 → Desconto 03 fallback), não calculado
   - Método extra: `readMaxDiscount(productCode)` (acessado via duck-typing no orchestrator)

3. **Implementar `src/cli/index.ts`** (Task 15).

4. **Rodar `pnpm test && pnpm build && pnpm lint`** e corrigir erros (Task 16).

5. **Commit final** e PR.
