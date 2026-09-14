# Assinaturas da plataforma UP Zero

## Escopo

Billing em `/settings/billing`: contratação mensal Starter R$ 899 / Pro R$ 1.199, cartões salvos, cartão padrão, troca de cartão da recorrência, troca de plano, cancelamento e últimas 100 cobranças do cliente. Interface com marca UP Zero, sem links para checkout/faturas do provedor nem resposta bruta do gateway. Somente cartão de crédito nesta etapa; Pix e boleto não são métodos oferecidos por este fluxo.

O cliente cadastra o cartão e confirma a contratação separadamente. Tokenização não cobra mensalidade; contratar solicita primeira cobrança no dia atual em America/Sao_Paulo. Status ACTIVE da assinatura é recorrência configurada, **não** comprovação de pagamento. O histórico mostra a situação das cobranças. Não foi alterado o controle de acesso aos módulos da plataforma.

Troca de plano muda mensalidades futuras ainda não emitidas, sem proporcional imediato, usando `updatePendingPayments: false`. Troca de cartão usa o endpoint específico, não faz cobrança imediata e também troca o cartão de cobranças pendentes. Cancelamento desativa a recorrência (`status: INACTIVE`) e marca o contrato local como cancelado; faturas existentes permanecem, sem reembolso automático. Não usa DELETE, pois esse endpoint também excluiria cobranças pendentes/vencidas. Remover cartão remove seu token local; não pode remover o cartão de uma assinatura vigente.

WhatsApp R$ 99/número/mês e IA R$ 10/geração continuam no simulador. O consumo automático e sua inclusão nas faturas ainda não estão implementados. O backend não aceita valores monetários enviados pelo navegador.

## Configuração do operador (não expor no Admin do cliente)

1. Aplicar `db/migrations/003_platform_billing.sql` no Postgres usado pelo Admin (`DATABASE_URL` ou `POSTGRES_URL`). Tabelas isoladas por loja e ambiente.
2. Configurar apenas no servidor:
   - `ASAAS_ENVIRONMENT=sandbox` inicialmente; `production` somente após homologação.
   - `ASAAS_API_KEY`: chave da conta UP Zero no ambiente escolhido.
   - `BILLING_TOKEN_ENCRYPTION_KEY`: segredo estável de 32 bytes em hexadecimal; não rotacionar sem migrar tokens.
   - `ASAAS_WEBHOOK_TOKEN`: segredo próprio, diferente da chave de API.
3. Criar webhook POST `https://<dominio-admin>/api/webhooks/billing`, eventos de assinaturas e cobranças, com o mesmo token. O header de autenticação é `asaas-access-token`. O endpoint persiste ID/tipo/recurso, sem payload com dados pessoais. IDs duplicados são ignorados. Billing consulta o estado atual pela API; eventos fora de ordem não sobrescrevem status.
4. Produção requer HTTPS e habilitação da tokenização na conta Asaas. A configuração incompleta mantém cadastro/contratação indisponíveis, sem sucesso fictício.
5. Na Vercel, o IP do pagador vem de `x-vercel-forwarded-for`. Em outro servidor, configurar o proxy para remover/recriar `X-Forwarded-For` e somente então definir `BILLING_TRUST_PROXY=true`. Nunca usar IP fornecido no corpo da solicitação.
6. Não coletar payloads de `/api/billing` em logs/APM/session replay. PAN/CVV existem apenas no formulário e na requisição transitória HTTPS; não são gravados em banco, localStorage, auditoria ou mensagens de erro. Revisar os requisitos de captura direta de cartão com o gateway antes de produção.

Notificações automáticas do gateway são desabilitadas ao criar o cliente; a interface não redireciona para páginas com marca Asaas. A UP Zero deve definir sua comunicação transacional de cobranças. A descrição na fatura bancária do cartão é controlada pela conta adquirente/gateway e não por esta interface.

## Segurança e operações incertas

`/admin/me` e as permissões são confirmados no backend de autenticação, sem confiar apenas no JWT ou aceitar sessão local de teste para operações financeiras. GET exige `settings.view` ou `settings.edit`; alterações exigem `settings.edit`. POST valida Origin, HTTPS em produção, limite de corpo, campos estritos e consentimento explícito. Até cinco cartões por loja e 20 operações/hora. Tokens AES-256-GCM vinculados a loja/ambiente. Nenhum token é enviado ao navegador.

Cada alteração possui UUID de operação e trava persistente por loja/ambiente. Repetir uma operação concluída não executa o gateway novamente. Timeout, 5xx ou falha de gravação após sucesso remoto mantém trava, impedindo cobrança duplicada. Não há retentativa automática de POST.

Para conciliação, o operador deve consultar `platform_billing_operations` e o estado da conta, verificar no gateway a operação original e só então, em transação, corrigir `state`, marcar a operação concluída/fracassada e limpar `operation_id`. Criações usam `externalReference=upzero:<ambiente>:<storeId>:<requestId>`, clientes usam `upzero:<ambiente>:store:<storeId>`. Não liberar uma operação apenas por tempo decorrido. Se o token não foi persistido, confirmar que não existe cobrança antes de liberar novo cadastro. Não há desbloqueio financeiro pelo cliente.

## Verificação

`node --import tsx --test tests/billing.test.ts`

Testes simulam o gateway e a persistência, cobrindo preços, consentimento, isolamento de cartões, operações repetidas, timeouts, criptografia, descarte de PAN/CVV e falha de banco após resposta remota. Antes de produção, testar no Sandbox tokenização, aprovação/recusa, duas abas concorrentes, troca, cancelamento e webhook duplicado. Nenhuma cobrança real é feita pelos testes.

Referências:
- https://docs.asaas.com/reference/tokenizacao-de-cartao-de-credito
- https://docs.asaas.com/reference/criar-assinatura-com-cartao-de-credito
- https://docs.asaas.com/reference/atualizar-cartao-de-credito-assinatura
- https://docs.asaas.com/reference/atualizar-assinatura-existente
- https://docs.asaas.com/docs/sobre-os-webhooks

## Consumo no Billing

`GET /api/billing/usage` autentica a loja separadamente da configuração do gateway. Exibe números de WhatsApp do `store_scope` exato no Postgres, sem compartilhar o cache global da mensageria entre lojas. Números CONNECTED distintos, não removidos, entram na previsão a R$ 99/mês. Demais números aparecem como conexão não confirmada. Cadastro sem vínculo ou erro de leitura não vira consumo zero.

O Estúdio lista todos os ensaios privados da loja no mês civil de Brasília. Um pacote com frente/costas/lateral/detalhe corresponde a R$ 10 de previsão; tentativas extras e ensaios parciais não são cobrados por essa estimativa. `completedAt` é gravado na primeira conclusão e não muda em publicação/download/refação. Para histórico legado sem esse campo, usa-se criação, explicitamente indicada na tabela. O total representa uma previsão por mês civil, não o ciclo contratual nem uma fatura final. WhatsApp não tem proporcional por dias nesse painel. Valores ainda não são enviados automaticamente ao gateway.
