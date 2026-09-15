# Master UP Zero — primeira entrega

## Estrutura

Aplicativo Next.js separado em `master/`, no mesmo repositório e com implantação independente. Usa as dependências e lockfile da raiz; não instalar uma segunda árvore de dependências no Master. O alias `@/*` aponta para a raiz para compartilhar os componentes reais do Admin: botões, tabelas, tabs, dialogs, badges, cards de indicadores, paginação, temas e CSS. A tipografia Geist vem da distribuição de Next instalada. A navegação Master tem configuração própria, sem o contexto de loja única do Admin.

O TypeScript do Admin exclui `master/`; o Master tem sua própria checagem estrita e build. Nenhuma rota do Admin foi movida. A sessão usa o cookie exclusivo `upzero_master_session`, HttpOnly e SameSite Strict; Secure em produção. Publicar em host próprio sem compartilhar cookies de domínio com o Admin.

## Executar

Instalar as dependências na raiz com `npm ci`, usando o `package-lock.json` versionado. Guia de checkout: [master/README.md](../master/README.md). Depois:

```sh
cd master
npm run dev:demo
```

Abrir `http://127.0.0.1:3010`. A demonstração funciona somente com `NODE_ENV=development` e `MASTER_DEMO_MODE=true`; o script limita o servidor ao loopback. Cada entrada cria dados fictícios independentes por sessão, válidos por oito horas. Alterações persistem em `master/.data/master-demo`, fora do Git, durante a sessão. Logout remove seus dados. Persistência serializada em um único processo, destinada somente ao desenvolvimento. Arquivos de sessões expiradas podem ser limpos com o servidor desligado.

Sem modo demo e sem `MASTER_API_URL`, o login fica indisponível; nunca ocorre fallback automático para demonstração ou para o token do Admin.

## Disponível

- Visão geral: lojas por situação, assinaturas ativas, recebido por data de pagamento e total vencido.
- Lojas: busca por nome, domínio, responsável, e-mail e ID; filtros de plano/situação e paginação.
- Ficha: dados, situação, plano de acesso, módulos, integração/Chave API, cobranças e histórico.
- Alteração de situação e plano de acesso, com motivo e controle de revisão para evitar sobrescrita concorrente. Isso não altera a assinatura do gateway.
- Módulos: matriz por loja e exceções por módulo, permanentes ou com vencimento às 23:59 de Brasília; no vencimento volta à regra do plano.
- Chave API: mascarada, buscada somente por POST autorizado ao revelar/copiar; ocultação após 60 segundos, mudança de aba ou perda de foco. Não é enviada na listagem nem no HTML inicial. O servidor registra o acesso antes de liberar a chave, sem seu conteúdo. Evento de cópia significa que a chave foi disponibilizada para cópia; a confirmação visual de sucesso depende da Clipboard API.
- Financeiro: consulta por mês de vencimento e situação. Relatórios: recebimentos por plano atual e adoção de módulos. Equipe: consulta de perfis/permissões. Histórico: busca e valores antes/depois.
- Estados vazios, acesso restrito, falha de conexão, página inexistente, temas claro/escuro e navegação mobile.

## Integração real pendente

A base desta entrega contém o Admin vinculado a uma loja. O billing foi desenvolvido separadamente e sua integração deve ser coordenada com essa entrega. Não foi identificado backend global de Master. Os endpoints abaixo são um **contrato proposto**, não endpoints existentes confirmados. `MASTER_API_URL` deve apontar exclusivamente para um backend que implemente esse contrato. Não apontar diretamente para a API de loja ou para o gateway.

Os esquemas executáveis ficam em `master/lib/contracts.ts`. Valores monetários em centavos, datas ISO, IDs de loja inteiros positivos. O backend deve fornecer valores filtrados pelas permissões, sem chaves em objetos de loja. As chaves existentes podem estar em `storefront_api_key`, `storefrontApiKey`, `api_key` ou `apiKey`; confirmar a chave correta e o acesso autorizado no backend antes de mapear. Não chamar endpoints de loja com tokens privilegiados no navegador.

| Método / caminho relativo | Contrato |
| --- | --- |
| `POST /auth/login` | Recebe `{ email, password }`; devolve `{ token, session }`. Autenticação exclusiva da equipe Master, com limitação de tentativas no backend. |
| `GET /auth/me` | Bearer token; devolve `sessionSchema`, obrigatoriamente `mode: "live"`. Valida revogação, expiração e permissões atuais. |
| `POST /auth/logout` | Revoga o token no servidor. |
| `GET /workspace` | Bearer token; devolve `workspaceSchema`: lojas, cobranças, histórico, equipe e horário de atualização. MVP em snapshot; paginação/agregação no backend antes de grandes volumes. |
| `POST /stores/:id/actions` | Bearer token; recebe `mutationSchema`; autoriza ação/loja, grava alteração e auditoria em transação. |

Sessão: `{ id, name, email, role, permissions, mode }`. Permissões: `stores.read`, `stores.write`, `keys.read`, `modules.write`, `billing.read`, `audit.read`, `team.read`, `sales.read`.

Ações:

- `store.update`: `revision`, `status`, `plan`, `reason`; devolve `{ success: true }`.
- `module.update`: `revision`, `code`, `override`, `expiresAt`, `reason`; devolve `{ success: true }`.
- `key.reveal` / `key.copy`: sem chave ou ator no corpo; devolve `{ key, auditId }`. Registrar ator a partir da sessão e nunca permitir retorno da chave se a auditoria falhar. Respostas sem cache, sem payloads em logs/APM; chaves não recuperáveis devem retornar indisponibilidade.

HTTP: 401 sessão inválida, 403 sem permissão, 404 loja/chave inexistente, 409 revisão desatualizada, 422 entrada inválida, 429 limite. Em timeout não repetir operações automaticamente; conferir o estado antes de repetir. Os handlers locais validam origem, corpo, tamanho, sessão, permissão e DTO de resposta. O backend deve repetir a autorização, aplicar limites e fornecer auditoria durável.

## Próximas etapas

1. Localizar/implementar backend Master e autenticação global; homologar o catálogo de planos/módulos e o contrato com dados reais.
2. Aplicar efetivamente as liberações e suspensões nas APIs do Admin. Nesta entrega, as alterações de demonstração modificam somente o ambiente fictício.
3. Integrar o billing existente pelo serviço central, mantendo idempotência, travas e conciliação. Esta versão não emite, cancela ou cobra pagamentos.
4. Implementar criação de lojas, administração de usuários internos, consumo de WhatsApp/IA e conexão dos dashboards de vendas aos pedidos reais.
5. Definir acesso de suporte ao Admin, operações em lote e automações. Não há impersonação nesta entrega.

## Validação

```sh
cd master
npm run typecheck
npm test
npm run build
```

Testes cobrem exclusão de segredos do DTO, permissões, auditoria sem conteúdo de chave, isolamento entre sessões, revisão concorrente, expiração de módulos e revogação de sessão. Verificação HTTP e visual deve usar exclusivamente a demonstração local. O build de produção desabilita o modo demo mesmo se a variável estiver ligada.

### Resultado desta entrega

Build de produção, TypeScript e lint dos arquivos Master aprovados. Sete testes automatizados passaram. O smoke HTTP local validou ausência de sessão, origem cruzada, cookie HttpOnly, resposta sem cache, restrição de dados, bloqueio de revelação por perfil de consulta, rejeição de ator enviado pelo cliente e revogação após logout.

No navegador, foram conferidos login, busca, filtro por situação, paginação, revelar/copiar chave fictícia com registro no histórico e alteração de módulo com persistência e auditoria. Nenhuma loja ou cobrança real foi acessada ou alterada.

Para repetir o smoke HTTP, manter `npm run dev:demo` ativo e executar `npm run test:http` em outro terminal.

## Dashboard consolidado de marcas e clientes

A Visão geral abre em **Movimentação das marcas**. A aba **Operação da plataforma** preserva o painel de lojas/assinaturas. A nova rota `/clientes` apresenta os mesmos indicadores no mesmo critério e a lista de clientes, com busca local, atividade, ordenação, paginação e detalhes dos pedidos.

### Indicadores e filtros

- Filtros de data inicial/final inclusivas, marca e canal (B2B, B2C, Offline). Datas agrupadas em `America/Sao_Paulo`; padrão: mês corrente até a cobertura disponível. Atalho para últimos 30 dias.
- Solicitado e atendido: somas dos valores dos pedidos não cancelados **criados no período**. Atendido é o estado desses pedidos na atualização do snapshot, não faturamento fiscal ou dinheiro recebido naquele período.
- Quantidade de pedidos válidos exclui cancelados, informados separadamente.
- Ticket médio = soma atendida / quantidade de pedidos válidos; taxa de atendimento = soma atendida / soma solicitada. Nunca calcular média das médias das marcas.
- Cadastros de clientes identificados por `(storeId, customerId)`. Um comprador em duas marcas conta em dois cadastros; sem deduplicação por nome/e-mail. Clientes com pedido e recompra usam essa mesma identidade.
- Recompra no período = clientes com 2+ pedidos válidos no recorte / clientes com pedido válido no recorte. Não representa retenção histórica.
- Base cadastrada inclui clientes sem compras, registrados até o fim do período, nas marcas selecionadas. Canal filtra pedidos, não essa base. Busca/atividade/ordenação da lista não alteram os cards e são identificados como controles locais.
- Quantidade de itens solicitados/atendidos e itens por pedido. Sem denominador: “—”. Período coberto e vazio: zero em métricas aditivas. Fonte ausente ou período sem cobertura: estado indisponível, sem totais parciais apresentados como completos.
- Evolução diária de solicitado/atendido, composição por canal, comparativo de marcas com total consolidado e seleção de marca por linha. Os detalhes de cliente incluem cancelados para conferência, excluídos dos KPIs.

### Contrato da integração

Nova permissão `sales.read`, validada no servidor ao entregar o snapshot. Usuários sem essa permissão recebem `sales: null`, sem cadastros ou pedidos no payload. O dono de uma sessão **local de demonstração** anterior recebe a nova visão automaticamente; isso não altera permissões no backend real.

O contrato `/workspace` aceita `sales: null` (também padrão para fontes antigas) ou o `salesSchema` de `master/lib/sales.ts`:

- `customers`: `id`, `storeId`, `name`, `email`, `city`, `state`, `registeredAt` (ISO).
- `orders`: `id`, `storeId`, `customerId`, `channel`, `createdAt` (ISO), `status`, `requested`, `fulfilled`, `requestedItems`, `fulfilledItems`. Dinheiro em **centavos de BRL**. A integração com o Admin deve converter as unidades explicitamente; não copiar valores em reais para estes campos.
- `status`: `pending`, `confirmed`, `partial`, `fulfilled`, `cancelled`.
- `coverageFrom`, `coverageThrough`: dias ISO com cobertura completa de pedidos, e `updatedAt`: instante ISO de atualização da origem.
- A origem deve entregar todos os pedidos no intervalo declarado e toda a base de clientes até seu fim. Snapshot paginado ou parcial não pode ser declarado completo. Para escala, mover agregação/paginação ao backend mantendo estas definições.
- Pedidos sem cadastro precisam de identificação de comprador consistente por marca definida no backend antes de entrar neste contrato. Não inferir identidade por nome/e-mail. Nomes e documentos pessoais não devem constar na URL dos filtros.
- Validação rejeita duplicados dentro da marca, pedidos sem cadastro vinculado, clientes de marca fora do escopo, datas fora da cobertura e valores atendidos superiores aos solicitados. Regras de devoluções, ajustes negativos e moedas diferentes exigem evolução explícita do contrato antes da integração.

A demonstração usa `master/lib/demo-sales.ts`: 120 cadastros fictícios em 12 marcas, pedidos com atendimento total/parcial, cancelamentos, canais distintos e clientes sem pedido. Os dados são determinísticos por dia e respeitam a criação da marca/cadastro. Nenhum pedido real é consultado. Integração real continua pendente do backend Master.

### Validação adicional

Oito testes de vendas cobrem soma entre todas as dimensões, ticket ponderado, identidades iguais em marcas distintas, filtros combinados, limites do dia de Brasília, períodos vazios/sem cobertura, integridade do contrato e exclusão de clientes/pedidos do perfil sem permissão. A suíte totaliza 15 testes.
