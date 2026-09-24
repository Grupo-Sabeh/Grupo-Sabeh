# Agente de triagem de emails — Rodrigo Sabeh

Dois workflows do n8n que:

1. **Triagem** (`workflow-triagem.json`), a cada 10 minutos: lê os emails novos da caixa do Rodrigo, classifica cada um com o Claude Haiku, responde sozinho "Ok, recebido." **somente** para funcionários que só estão informando algo, aplica um marcador no Gmail e registra tudo numa planilha.
2. **Relatório diário** (`workflow-relatorio-diario.json`), todo dia às 18h: lê a planilha, pede ao Claude Sonnet um relatório em português e envia por email em HTML fácil de ler no celular.

> **Segurança:** nenhuma chave, senha ou token fica nestes arquivos. Todas as credenciais são criadas na interface do n8n (passos abaixo).

---

## Como funciona

### Triagem

```
Gmail (novo email) → Preparar email → Claude Haiku → Interpretar resposta
   → [IF regra fixa] ─ sim → [IF MODO_RASCUNHO] ─ true  → Criar rascunho "Ok, recebido."
   │                                           └ false → Enviar "Ok, recebido."
   └ não ───────────────────────────────────────────────→ Montar registro
   → Separar por marcador → Marcar: Assistente/... → Registrar na planilha
```

| Categoria | O que acontece |
|---|---|
| `resposta_automatica` | Só vira resposta se passar na **regra fixa**: remetente do domínio interno, sem sinais de email automático ou falsificado. Com `MODO_RASCUNHO = true` o n8n cria só um rascunho. Se a regra bloquear, o email vai para `precisa_rodrigo`. |
| `precisa_rodrigo` | Nenhuma resposta. Entra no relatório com sugestão de resposta. |
| `informativo` | Nenhuma resposta. |
| `propaganda` | Nunca é respondida. |
| `possivel_golpe` | Nunca é respondido. Aparece como alerta no relatório. |

A **regra fixa** fica no nó IF "Pode responder sozinho? (regra fixa)", fora da IA. Ela só deixa passar quando as 4 condições são verdadeiras:

1. a IA respondeu um JSON válido;
2. a categoria é `resposta_automatica`;
3. o domínio do remetente está em `DOMINIOS_INTERNOS`;
4. o email não tem nenhum destes sinais: falha de SPF, DKIM ou DMARC, cabeçalho `Auto-Submitted`, `Precedence: bulk/list`, cabeçalho de lista (`List-Unsubscribe`/`List-Id`) ou endereço no-reply. Isso evita loops com outros robôs e remetentes falsificados.

**Quando algo dá errado:**
- **A API do Claude falha** (fora do ar, timeout ou resposta inválida): o n8n tenta 3 vezes. Se continuar falhando, o email vira `precisa_rodrigo` e nunca é respondido.
- **A IA devolve um JSON estranho:** o n8n remove as marcações ```` ```json ````, extrai o objeto e confere a categoria. Se não der, o email vira `precisa_rodrigo`.
- **A criação do rascunho ou o envio falha:** a planilha registra "ERRO ao ..." e o email vai para Precisa Rodrigo.
- **A aplicação do marcador falha:** o email é registrado na planilha mesmo assim.

### Relatório diário

- **Período coberto:** as **últimas 24h** (de ontem às 18h até hoje às 18h). Assim nenhum email que chega depois das 18h fica de fora.
- **Seções:** resumo geral, emails que precisam do Rodrigo (com sugestão de resposta), alertas de golpe, respondidos automaticamente, informativos, propagandas e resumo email por email.
- **Dia sem emails:** o workflow envia um aviso curto.
- **Falha do Sonnet:** o relatório é enviado mesmo assim, numa versão simples montada direto da planilha.
- **Links:** o HTML gerado pela IA passa por uma limpeza. Só sobram links para o próprio Gmail ("abrir no Gmail"). Scripts, imagens e outros links são removidos.

---

## 1. Informações a preencher

| O quê | Onde |
|---|---|
| Domínio interno (ex.: `gruposabeh.com.br`) | Triagem → nó **Preparar email** → `DOMINIOS_INTERNOS` |
| Modo rascunho (`true`/`false`) | Triagem → nó **Preparar email** → `MODO_RASCUNHO` |
| Email que recebe o relatório | Relatório → nó **Filtrar emails do período** → `EMAIL_RELATORIO` |
| Fuso horário | Já vem `America/Sao_Paulo` nas configurações dos dois workflows e nos nós de código |

Os workflows foram feitos para **Gmail / Google Workspace**. Se a caixa do Rodrigo for Outlook, troque os nós Gmail pelos nós Microsoft Outlook equivalentes. Todo o resto continua igual.

---

## 2. Credenciais do Google (Gmail + Sheets)

### 2.1 Google Cloud Console

1. Acesse https://console.cloud.google.com/ com a conta do Rodrigo (ou a conta administradora do Workspace) e crie um projeto, por exemplo `n8n-assistente-emails`.
2. Em **APIs e serviços → Biblioteca**, ative:
   - **Gmail API**
   - **Google Sheets API**
   - **Google Drive API** (o n8n usa para listar as planilhas no seletor)
3. Em **APIs e serviços → Tela de consentimento OAuth** (ou "Google Auth Platform"):
   - Tipo de usuário **Interno** se a conta for Google Workspace. É o recomendado, porque os tokens não expiram.
   - Se for Gmail pessoal, use **Externo**, adicione o email do Rodrigo em **Usuários de teste** e depois clique em **Publicar app**. Enquanto o app estiver "Em teste", o Google derruba o login a cada 7 dias.
4. Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**
   - **URIs de redirecionamento autorizados**: `http://localhost:5678/rest/oauth2-credential/callback`. Quando migrar para a VPS, adicione também `https://SEU-DOMINIO/rest/oauth2-credential/callback`.
   - Copie o **Client ID** e o **Client Secret**. Eles vão direto para o n8n e não devem ser salvos em nenhum arquivo.

### 2.2 No n8n

1. **Credentials → Add credential → Gmail OAuth2 API**: cole o Client ID e o Client Secret, clique em **Sign in with Google** e entre com a conta do Rodrigo.
2. **Credentials → Add credential → Google Sheets OAuth2 API**: use o mesmo Client ID e Client Secret e faça login com a conta dona da planilha.

## 3. Credencial da Anthropic (Header Auth)

1. Gere uma chave em https://console.anthropic.com/ → **API Keys**.
2. No n8n: **Credentials → Add credential → Header Auth**.
   - **Name:** `x-api-key`
   - **Value:** a chave da Anthropic
   - Nome da credencial, por exemplo: `Anthropic API`
3. Nos nós **Claude Haiku - classificar** e **Claude Sonnet - relatório**, selecione essa credencial em *Header Auth*. O cabeçalho `anthropic-version: 2023-06-01` já vem configurado.

## 4. Planilha

1. Crie no Google Sheets uma planilha chamada **Triagem de Emails - Rodrigo**.
2. Renomeie a aba para **Emails**.
3. Na **linha 1**, escreva exatamente estes cabeçalhos, um por coluna (de A até M):

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| registrado_em | data_hora | remetente | remetente_email | assunto | categoria | urgencia | resumo | o_que_pedem | motivo_classificacao | acao_tomada | message_id | link |

- `registrado_em`: quando o n8n processou o email, em UTC. O relatório usa esta coluna para saber o período.
- `data_hora`: quando o email chegou, no horário de Brasília.
- `acao_tomada`: o que o assistente fez (rascunho criado, respondido, bloqueado pela regra, nenhuma ação...).

A planilha recebe os dados como texto puro (modo `RAW`). Um assunto que comece com `=` não vira fórmula.

## 5. Marcadores no Gmail

No Gmail do Rodrigo, crie estes marcadores. Para criar um sub-marcador, use **Aninhar marcador em: Assistente**.

- `Assistente/Respondido`
- `Assistente/Precisa Rodrigo`
- `Assistente/Informativo`
- `Assistente/Propaganda`
- `Assistente/Possível Golpe`

## 6. Importar os workflows

1. Abra o n8n em http://localhost:5678.
2. **Workflows → Add workflow → ⋯ (menu) → Import from File…** e escolha `workflow-triagem.json`. Repita o processo com `workflow-relatorio-diario.json`.
3. No workflow **Rodrigo - Triagem de emails**:
   - Abra cada nó Gmail (**Novo email**, **Criar rascunho**, **Enviar**, os 5 **Marcar: ...**) e selecione a credencial Gmail.
   - Em cada nó **Marcar: ...**, escolha o marcador correspondente no campo *Label Names or IDs*.
   - No nó **Claude Haiku - classificar**, selecione a credencial `Anthropic API`.
   - No nó **Registrar na planilha**, selecione a credencial do Sheets e escolha a planilha (*From list*). A aba já está como `Emails`.
   - No nó **Preparar email**, ajuste `DOMINIOS_INTERNOS` e confira se `MODO_RASCUNHO = true`.
   - Salve.
4. No workflow **Rodrigo - Relatório diário de emails**:
   - Selecione as credenciais em **Ler planilha**, **Claude Sonnet - relatório**, **Enviar relatório** e **Enviar aviso (sem emails)**.
   - Em **Ler planilha**, escolha a mesma planilha da triagem.
   - No nó **Filtrar emails do período**, preencha `EMAIL_RELATORIO`.
   - Salve.

O gatilho usa o filtro `in:inbox -from:me`: só lê a caixa de entrada e ignora o que o próprio Rodrigo envia, incluindo o relatório e as respostas "Ok, recebido.". Ele lê emails lidos e não lidos, para não perder nada que o Rodrigo abrir no celular antes da próxima leitura.

## 7. Testar manualmente em modo rascunho

Com `MODO_RASCUNHO = true` nada é enviado: o n8n só cria rascunhos.

1. De uma conta do **domínio interno**, envie ao Rodrigo: *"Rodrigo, segue em anexo o relatório de vendas da semana."*
2. No workflow de triagem, clique em **Execute workflow** (ou *Test workflow*). Em execução manual, o gatilho do Gmail busca o email mais recente.
3. Confira:
   - cada nó ficou verde;
   - existe um **rascunho** "Ok, recebido." na mesma conversa, na pasta Rascunhos;
   - o email recebeu o marcador `Assistente/Respondido`;
   - apareceu uma linha nova na planilha.
4. Repita o teste com outros casos:

| Email de teste | Resultado esperado |
|---|---|
| Interno: "Pode aprovar o orçamento de R$ 15 mil até sexta?" | `precisa_rodrigo`, sem rascunho |
| Gmail pessoal: "Oi, só avisando que enviei o documento" | Não responde (regra fixa: remetente externo) → `precisa_rodrigo` |
| Newsletter qualquer | `propaganda`, sem rascunho |
| Externo: "URGENTE: atualize os dados bancários para o pagamento de hoje" | `possivel_golpe`, sem rascunho |
| Com a chave da Anthropic errada de propósito | `precisa_rodrigo` com "Erro na classificação", sem rascunho |

5. Para testar o relatório, abra o workflow de relatório e clique em **Execute workflow**. O relatório das últimas 24h chega no `EMAIL_RELATORIO`.
6. Se tudo funcionar, ative os dois workflows no botão **Active** (em versões novas: **Publish**). Daí em diante a triagem roda a cada 10 minutos e o relatório todo dia às 18h.

Durante 1 a 2 semanas, confira na planilha a coluna `categoria` e os rascunhos criados. Se a IA errar muito num tipo de email, ajuste o texto do prompt (`SYSTEM`) no nó **Preparar email**.

## 8. Desligar o modo rascunho

Quando a classificação estiver confiável:

1. Abra o workflow de triagem → nó **Preparar email**.
2. Troque `const MODO_RASCUNHO = true;` por `const MODO_RASCUNHO = false;`.
3. Salve (e publique, se a sua versão do n8n pedir).

A partir daí, as respostas "Ok, recebido." são enviadas de verdade, só para funcionários do domínio interno. Para voltar ao modo seguro, volte o valor para `true`.

## 9. Migrar para uma VPS (depois)

1. Instale o n8n na VPS (Docker é o mais simples) com HTTPS e defina `GENERIC_TIMEZONE=America/Sao_Paulo`.
2. Exporte os workflows do n8n local e importe na VPS. As credenciais precisam ser criadas de novo lá.
3. No Google Cloud Console, adicione o novo URI de redirecionamento: `https://SEU-DOMINIO/rest/oauth2-credential/callback`.
4. **Desative** os workflows no n8n local antes de ativar na VPS. Se os dois rodarem ao mesmo tempo, cada email é processado duas vezes.

## Custos (estimativa)

- **Classificação com Haiku:** cerca de 1–3 mil tokens por email. Com 100 emails por dia, fica em poucos dólares por mês.
- **Relatório com Sonnet:** uma chamada por dia.
- Acompanhe o gasto em https://console.anthropic.com/ e, se quiser, defina um limite mensal lá.
