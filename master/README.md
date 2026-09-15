# Master UP Zero

Painel da equipe UP Zero para administrar marcas, lojas, módulos e integrações, com dashboards consolidados e lista de clientes. Compartilha componentes e dependências com o Admin na raiz do repositório.

## Baixar esta entrega

```sh
git clone --branch codex/master-upzero https://github.com/itsvitinhoin/up-zero.git up-zero-master
cd up-zero-master
npm ci
npm --prefix master run dev:demo
```

Abrir **http://127.0.0.1:3010** e escolher “Administrador Master” na demonstração. Também há perfil de consulta para testar restrições de acesso. Instale as dependências na **raiz**, onde está o `package-lock.json`; o projeto `master/` usa essa mesma instalação.

Se o repositório já estiver clonado, com as alterações locais salvas:

```sh
git fetch origin
git switch codex/master-upzero
npm ci
npm --prefix master run dev:demo
```

## Validar

A partir da raiz:

```sh
npm --prefix master run typecheck
npm --prefix master test
npm --prefix master run build
```

Com a demonstração rodando, execute `npm --prefix master run test:http` em outro terminal. São 15 testes de domínio/KPIs e uma verificação HTTP de autenticação, permissões e acesso às chaves.

## O que está implementado

- Visão geral com solicitado, atendido, pedidos, ticket médio, clientes, recompra e itens.
- Evolução diária, filtros por período/marca/canal e comparativo entre marcas.
- Clientes com busca, ordenação, paginação e detalhamento dos pedidos.
- Listagem e ficha das lojas, configuração de módulos e histórico de ações.
- Chave API mascarada com revelação/cópia autorizada e auditada.
- Consultas de assinaturas/cobranças, equipe e permissões.

## Integração real e produção

A demonstração usa **dados fictícios** e funciona somente em desenvolvimento. O build de produção não habilita a demonstração. Nenhuma configuração, sessão, chave ou dado de loja real acompanha esta entrega.

O backend global do Master ainda precisa ser implementado ou conectado conforme o contrato em [docs/master.md](../docs/master.md). As operações de demonstração alteram somente esse ambiente fictício. O Master não emite cobranças reais nem aplica liberações no Admin real nesta entrega.

Após disponibilizar o backend:

1. Copiar `master/.env.example` para `master/.env.local` e configurar `MASTER_API_URL` com a URL HTTPS do serviço global.
2. Configurar autenticação/permissões, consulta de lojas/clientes/pedidos e auditoria no backend conforme os esquemas de `master/lib/contracts.ts` e `master/lib/sales.ts`.
3. Executar o build e iniciar com `npm --prefix master start` em ambiente de homologação. Em hospedagem com variáveis gerenciadas, configure-as no serviço, sem versionar arquivos `.env.local`.
4. Homologar o controle de módulos, billing, escopo de dados e credenciais antes de liberar produção.

O guia detalhado explica métricas, unidades (centavos de BRL), isolamento de clientes por marca, limites de cobertura dos dados e pontos pendentes.
