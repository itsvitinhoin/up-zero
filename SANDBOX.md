# Ambiente local isolado

O desenvolvimento usa três processos:

- API sandbox: `http://localhost:8080`
- Admin: `http://localhost:3000`
- Vitrine: `http://localhost:3001/1043`

A sandbox usa a loja virtual `1043`. Leituras que ainda não possuem dados locais são
espelhadas da loja `8`, mas todas as gravações são interceptadas antes de chegar à API
de produção. O perfil da loja (`PUT/PATCH /stores/1043`) possui persistência local em
`.sandbox/state.json`.

## Inicialização

Em terminais separados:

```bash
npm run sandbox:api
npm run dev
```

Na Vitrine:

```bash
npm run dev -- -p 3001
```

O acesso do Admin usa `LOCAL_ADMIN_EMAIL` e `LOCAL_ADMIN_PASSWORD` de `.env.local`.
Essas credenciais são verificadas apenas em `localhost:8080` e não são enviadas para a
API de produção.

## Contas B2C vinculadas para teste

Com os três serviços locais em execução, rode:

```bash
npm run sandbox:seed-b2c
```

O comando é idempotente: cria a conta consumidora, garante uma solicitação com produto
e a atribui ao revendedor demo. As credenciais são exclusivamente locais:

- Consumidor: `consumidor.b2c@upzero.local` / `123456`
- Revendedor: `cliente.demo@upvitrine.local` / `123456`

O consumidor também pode ser identificado pelo CPF `52998224725`. A solicitação pode
ser vista em **Minha conta > Meus pedidos** pelo consumidor e em **Minha conta >
Oportunidades B2C** pelo revendedor.

## Garantia de isolamento

O proxy somente encaminha `GET` e `HEAD` para `https://api.upzero.com.br`. Qualquer
outro método recebe `409 SANDBOX_WRITE_BLOCKED`, exceto a atualização local do perfil
da loja virtual.

## Revendedores reais em modo seguro

Por padrão, o canal B2C usa revendedores simulados e todas as solicitações continuam
em `.sandbox/state.json`. Para consultar uma lista real sem permitir qualquer escrita,
configure somente em `.env.local`:

```bash
SAFE_RESELLER_MODE=api
SAFE_RESELLER_API_URL=https://api.exemplo.com/revendedores
SAFE_RESELLER_API_STORE_ID=ID_DA_LOJA
SAFE_RESELLER_API_AUTH=x-api-key
SAFE_RESELLER_API_KEY=CHAVE_LOCAL
```

`SAFE_RESELLER_API_AUTH` aceita `x-api-key` ou `bearer`. A URL precisa usar HTTPS e o
conector fixa o método em `GET`, não segue redirecionamentos e não salva a resposta
bruta. O Admin persiste apenas o recorte necessário para a roleta local. CPF/CNPJ não
é enviado à Vitrine. Use o botão **Sincronizar agora** em Configurações > B2C após
validar a URL e o tipo de autenticação com o responsável pela API.
