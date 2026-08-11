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

## Garantia de isolamento

O proxy somente encaminha `GET` e `HEAD` para `https://api.upzero.com.br`. Qualquer
outro método recebe `409 SANDBOX_WRITE_BLOCKED`, exceto a atualização local do perfil
da loja virtual.
