# Fluxo UP Zero → automações WhatsApp

Este documento registra o contrato validado a partir da especificação OpenAPI
publicada em `https://api.upzero.com.br/docs`, do repositório
`itsvitinhoin/up-dash-b2b` e da implementação correspondente no Admin Next.

## Endpoints

- Eventos do e-commerce: `POST /api/mensageria/events/ecommerce`
- Validação sem disparo: `POST /api/mensageria/events/ecommerce?dry_run=1`
- Processamento de jobs vencidos: `GET|POST /api/mensageria/automations/process`
- Webhook da Meta (mensagens e status): `GET|POST /api/mensageria/webhook`

## Autenticação do webhook UP Zero

O endpoint exige `UPZERO_WEBHOOK_SECRET` no servidor e aceita uma das opções:

1. HMAC SHA-256 do corpo bruto em `x-upzero-signature: sha256=<hex>`;
2. `x-upzero-webhook-token: <segredo>`;
3. `Authorization: Bearer <segredo>`;
4. `?token=<segredo>` (compatibilidade com o webhook do UP Dash).

O endpoint também aceita `type`, `phone` e `event_id` pela query string. Isso
permite usar diretamente a URL dinâmica cadastrada na UP Zero:

```text
https://next-upzero.vercel.app/api/mensageria/events/ecommerce?token=<segredo>&type={{type}}&phone={{phone}}
```
5. campo `token` no corpo (removido antes da persistência).

Produção nunca aceita o endpoint sem segredo configurado.

A API oficial informa que o segredo cadastrado no webhook é usado para HMAC,
mas a versão atual da documentação não especifica o nome/formato do header de
assinatura. Por compatibilidade, o receptor aceita `x-upzero-signature` e
`x-binext-signature`, com ou sem o prefixo `sha256=`. Antes da homologação, o
header realmente enviado deve ser confirmado nos logs de uma entrega.

## Envelope aceito

```json
{
  "event": "cart_abandoned",
  "store_id": 1,
  "timestamp": "2026-08-17T14:00:00.000Z",
  "data": {
    "id": 987,
    "client_id": 145,
    "phone": "+5511999999999",
    "customer_phone": "+5511999999999",
    "customer_name": "Cliente",
    "customer": {
      "id": 145,
      "name": "Cliente",
      "phone": "+5511999999999"
    },
    "status": "abandoned",
    "recovery_token": "token-sanitizado",
    "recovery_url": "https://loja.exemplo.com/r/carrinho?rt=token-sanitizado",
    "recovery_expires_at": "2026-08-24T14:00:00.000Z",
    "recovery_max_uses": 30
  }
}
```

Também são aceitos `event_type`, `eventType`, `type` ou `name`, e
`payload` no lugar de `data`.

## Eventos normalizados

- Cadastro: `customer.created`, `customer.updated`,
  `customer.approved`, `customer.rejected`,
  `customer.registration_incomplete`,
  `customer.whatsapp_opt_in_missing`,
  `customer.whatsapp_opt_in_confirmed`.
- Carrinho: `cart_created`, `cart_abandoned`, `cart_converted`.
- Pedido: `order.created`, `order.updated`, `order.reserved`,
  `order.confirmed`, `order.payment_confirmed`, `order.processing`,
  `order.invoiced`, `order.shipped`, `order.delivered`,
  `order.cancelled`.
- Link de pagamento: `payment_link.created`, `payment_link.updated`,
  `payment_link.cancelled`, `payment_link.expired`,
  `payment_link.completed`, `payment_link.payment_failed`.

Aliases como `cart.abandoned`, `checkout_abandoned`,
`checkout.completed`, `payment.confirmed` e `order.payment.confirmed`
são convertidos para o nome canônico.

`order.updated` também é especializado conforme `order_status`:
`RESERVED`, `PROCESSING`, `INVOICED` e `CANCELLED`.

Eventos desconhecidos retornam HTTP 422. Eles não são silenciosamente
convertidos para outro tipo.

## Idempotência

- `event_id` é a chave preferencial e deve ser único por evento de negócio.
- A documentação oficial não inclui `event_id` no envelope de carrinho.
- Sem `event_id`, o receptor gera uma chave pelo SHA-256 canônico dos dados de
  negócio, ignorando campos voláteis do envelope como `timestamp`.
- Reentregas com a mesma chave retornam `duplicate: true`. Uma automação que já
  possui job para esse evento não executa novamente; automações novas, ainda sem
  job para o evento, podem processar a reentrega com segurança.
- Mensagens recebidas da Meta também são deduplicadas por `wamid`.

## Regras de envio

1. O evento é persistido.
2. Regras ativas do mesmo tipo criam jobs com `scheduledAt`.
3. Delay zero é processado na própria requisição.
4. Delay maior que zero depende do endpoint de processamento/cron.
5. `cart_converted` cancela jobs pendentes de recuperação do mesmo
   `cart_id`.
6. Condições de status, estado, tipo de cliente, valor mínimo e opt-in são
   avaliadas antes do envio.
7. Sem opt-in WhatsApp, o envio é bloqueado e auditado.

## Escolha do número emissor

- Com `senderStrategy = seller_then_fallback` e `seller_phone` presente,
  o número precisa corresponder a uma conexão WhatsApp ativa.
- Se a vendedora foi informada mas não corresponde a uma conexão, o envio é
  bloqueado; não há fallback silencioso.
- Sem `seller_phone`, usa `fallbackPhoneNumberId` da integração, o número
  selecionado ou o fallback da regra.
- Com `senderStrategy = fallback_only`, sempre usa o número padrão.

## Templates e variáveis

O texto aprovado pela Meta usa placeholders numéricos sequenciais:
`{{1}}`, `{{2}}`, `{{3}}`.

O mapeamento deve ser salvo no template:

```json
{
  "1": "customer.name",
  "2": "order.id",
  "3": "order.total"
}
```

O mapeamento do template tem precedência sobre o da automação. Para templates
antigos sem mapeamento, o fallback sequencial é nome, pedido, total, telefone
e rastreio.

## Teste seguro

Use o mesmo segredo e acrescente `dry_run=1`. O endpoint valida e normaliza o
payload, informa as automações compatíveis e não persiste job nem envia
mensagem.

```bash
curl -X POST \
  'https://next-upzero.vercel.app/api/mensageria/events/ecommerce?dry_run=1' \
  -H 'Authorization: Bearer SEU_SEGREDO' \
  -H 'Content-Type: application/json' \
  --data @payload.json
```

## Configuração necessária na Vercel

- `UPZERO_WEBHOOK_SECRET`: segredo compartilhado com o emissor UP Zero.
- `CRON_SECRET`: segredo usado pelo processador de jobs.
- `DATABASE_URL`: persistência transacional dos eventos e jobs.
- Variáveis Meta já usadas pela conexão: `FACEBOOK_APP_SECRET`,
  `FACEBOOK_SYSTEM_USER_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` e IDs
  públicos do App/Configuration.

O agendador deve chamar periodicamente:

```http
GET /api/mensageria/automations/process
Authorization: Bearer <CRON_SECRET>
```

## Cobertura e lacunas da documentação oficial

A especificação informa todos os nomes de eventos, os endpoints para cadastrar
e remover webhooks, autenticação por `X-API-Key`/Bearer e consulta dos logs de
entrega. O corpo outbound completo está explicitamente documentado para
`cart_abandoned`. Clientes e pedidos possuem schemas REST detalhados, mas a
especificação ainda não descreve um envelope outbound próprio para cada evento
de cliente, pedido e link de pagamento.

Por isso, a homologação final usa o próprio endpoint de logs do UP Zero depois
de uma entrega controlada. Isso permite fechar header HMAC e formato real das
outras famílias sem usar dados pessoais reais nem disparar WhatsApp durante o
teste (`dry_run=1`).
