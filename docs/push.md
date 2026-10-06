# Push no Admin

O menu **Push** contém Visão geral, Campanhas, Públicos e Automações. As configurações ficam exclusivamente em **Configurações → Push** (`/settings/push`). A interface reutiliza AdminPage, AdminHero, AdminPanel, indicadores e controles existentes.

## Obter a branch e executar localmente

Branch: `codex/push-admin`, no repositório `itsvitinhoin/up-zero`, criada a partir da main remota atual. A entrega não faz merge nem deploy na main. O menu Comunicação foi removido da navegação desktop e mobile; Push permanece em menu próprio.

```sh
git fetch origin
git switch --track origin/codex/push-admin
npm ci
npm run dev
```

Configurar as variáveis do ambiente local a partir de `.env.example`. Não há credenciais ou dados de clientes nesta branch. A integração real do app, os eventos comerciais, a migração do banco e o agendador descritos abaixo continuam sendo pré-requisitos para envios de produção.

## Públicos dinâmicos

Uma lista armazena critérios, não uma cópia de pessoas. A composição é recalculada ao consultar os dados e ao materializar o disparo. A interface atualiza os dados a cada 30 segundos enquanto a aba está visível. Períodos podem usar datas fixas ou uma janela móvel de últimos N dias. Datas fixas seguem o fuso da loja.

Filtros: nome, CNPJ/CPF, status do cadastro, Android/iOS, registro no aplicativo e seu período, existência de pedido no período, quantidade mínima/máxima de compras. Pedidos cancelados, rascunhos, rejeitados e estornados são excluídos. A quantidade de compras considera pagamento PAID ou status CONFIRMED/INVOICED/SHIPPED/DELIVERED/COMPLETED. Administradores de teste não compõem públicos comerciais.

“Cadastro no app” significa dispositivo registrado após uso do aplicativo. A loja de aplicativos não informa downloads individuais para esta base. Uma pessoa pode possuir mais de um dispositivo; alcance comercial considera apenas tokens ativos com permissão GRANTED.

## Preparação do ambiente

1. Aplicar `db/migrations/004_push.sql` no banco usado por DATABASE_URL/POSTGRES_URL. Nenhuma migração é executada automaticamente em produção.
2. Configurar `PUSH_FCM_SERVICE_ACCOUNTS` no servidor: objeto JSON com chaves iguais aos IDs das lojas e valores contendo `project_id`, `client_email`, `private_key` da conta de serviço Firebase. Cada loja usa sua própria configuração. Nunca expor a chave privada no navegador ou no aplicativo.
3. Configurar `PUSH_EVENT_SECRETS`: objeto JSON `{ "1043": "segredo-longo-e-aleatorio" }`. Cada loja possui um segredo diferente, exclusivamente no backend confiável.
4. Configurar `PUSH_PROCESS_SECRET`, segredo exclusivo para o processador de fila.
5. Conectar o backend do aplicativo e os eventos comerciais ao contrato abaixo. Fazer o backfill dos clientes e pedidos existentes antes de usar segmentação por compras.
6. Configurar APNs no Firebase para iOS e implementar os destinos recebidos no aplicativo. Imagens no iOS exigem suporte nativo à extensão de notificação.
7. Habilitar o canal em Configurações → Push e configurar/ativar as automações necessárias.

Em desenvolvimento sem banco, dados são persistidos por loja em `.data/push` (ou PUSH_DATA_DIR), com escrita atômica e bloqueio. Este modo é recusado em produção: não há armazenamento efêmero para campanhas e regras de produção. PostgreSQL usa controle de revisão para evitar perda de atualizações simultâneas.

## Eventos do backend confiável

POST `/api/push-events`, Content-Type application/json. Headers:

- `x-push-timestamp`: Unix timestamp em segundos; validade de 5 minutos.
- `x-push-signature`: `sha256=` + HMAC-SHA256 de `timestamp + "." + corpoJSONExato`, usando o segredo daquela loja.

O segredo **não pode ser embutido no app nativo**. A API confiável valida a sessão nativa, resolve loja e pessoa e assina o evento para o Admin. Para ações comerciais, os eventos devem vir do estoque/pedidos reais, não de valores arbitrários enviados pelo consumidor.

Campos comuns: `id` único estável do evento, `storeId` inteiro, `occurredAt` ISO com fuso, `type`.

| type | Dados específicos |
|---|---|
| member.updated | member: id, name, document, status PENDING/APPROVED/REJECTED, kind CUSTOMER/RESELLER/ADMIN |
| device.registered | member conforme acima; device: id estável da instalação, token FCM, platform ANDROID/IOS, permission GRANTED/DENIED/UNKNOWN, active boolean |
| device.removed | deviceId; emitir ao encerrar a sessão, desinstalar quando detectável ou remover a instalação |
| order.updated | order: id, memberId, status RESERVED/CONFIRMED/PROCESSING/INVOICED/SHIPPED/DELIVERED/COMPLETED/CANCELED/REFUNDED, paymentStatus PENDING/PAID/REFUNDED, createdAt, cartId opcional, code opcional |
| cart.updated | cart: id, memberId, updatedAt, converted boolean; emitir em toda atividade e conversão |
| stock.requested | subscription: id único da solicitação, memberId, variantId |
| stock.updated | variantId, productId, productName, available numérico não negativo |
| b2b2c.assigned | assignment: orderId, memberId do revendedor, assignmentId único daquela atribuição, code opcional |

Emitir `member.updated` antes de eventos comerciais e registrar os dispositivos antes de enfileirar avisos. IDs devem ser os mesmos em todos os eventos. Para aparelhos de teste, usar `member.id = "admin:<id validado em /admin/me>"`, kind ADMIN. Somente o próprio administrador pode disparar teste ao seu dispositivo.

Eventos repetidos com o mesmo id são idempotentes. Registrar permissão DENIED/UNKNOWN ou active false impede novos disparos. Uma atualização de token também remove associações anteriores do mesmo token dentro da loja. Eventos de pedidos, estoque, dispositivos e atribuições antigos não substituem versões mais recentes.

## Processamento

POST `/api/push-process`, Authorization `Bearer <PUSH_PROCESS_SECRET>`, JSON `{ "storeId": 1043 }`. Executar pelo agendador do ambiente no mínimo a cada minuto, para cada loja habilitada. Cada execução processa até 25 dispositivos. Escalar a frequência conforme o volume e acompanhar pendências.

Campanhas imediatas e eventos podem iniciar processamento após a resposta HTTP. O agendador continua necessário para campanhas futuras, atrasos de pós-venda, inatividade de carrinho e retomada após horário de silêncio/limite diário. Jobs são reivindicados antes de qualquer chamada FCM; gravações concorrentes não repetem um envio.

O aceite do FCM é registrado como ACCEPTED, sem afirmar entrega, abertura ou venda. Chamadas com resultado incerto não são repetidas automaticamente. Jobs SENDING abandonados por encerramento do processo precisam de conciliação operacional antes de qualquer reenvio. O aplicativo recebe data.destination, data.destination_id e data.push_job_id, além do título, texto e imagem. Deve implementar a navegação para home/product/category/promotion/order/cart/review e revalidar o acesso ao pedido.

## Automações

- Estoque: transição de disponível <= 0 para > 0 na variação solicitada; uma fila por solicitação. Solicitações posteriores devem ter novo id.
- Carrinho: um lembrete por versão de atividade, após a inatividade configurada; retomada ou pedido cancelam avisos pendentes. Disponibilidade/preços são revalidados pelo app ao abrir o carrinho.
- Pós-venda: transição para o status configurado, com atraso. Pedido cancelado/estornado impede aviso pendente.
- B2B2C: evento de atribuição confirmada ao revendedor. Redirecionamentos invalidam avisos pendentes do responsável anterior. Este aviso não segue horário de silêncio nem limite comercial.

Pausar automação cancela seus avisos pendentes. Desabilitar o canal suspende todo o processamento. Rascunhos e públicos podem ser preparados mesmo sem credenciais; disparos e ativações são bloqueados até a configuração.

Permissões: messaging.view para consultar Push; messaging.send para públicos/campanhas/automações/testes; settings.view/settings.edit para configurações. Toda API valida a sessão e a loja no backend e protege as alterações por origem.

## Validação local

`npx --yes tsx@4.23.12 --test tests/push.test.ts` (executor de testes temporário; não altera as dependências da aplicação).

Os testes cobrem filtros combinados, janela de compras, limites do dia no fuso, atualização de público, consentimento, estoque por variação, retomada/conversão do carrinho, pós-venda, redirecionamento B2B2C, duplicação de eventos, horários, isolamento por loja, concorrência de persistência e processamento idempotente com adaptador de envio simulado.

Referências do adaptador: [autorização e envio FCM v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api) e [contrato REST de mensagens](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages).
