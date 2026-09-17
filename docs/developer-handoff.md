# Entrega: Billing e Estúdio IA

Branch: `codex/ai-studio-deploy` no repositório `itsvitinhoin/up-zero`.

```sh
git fetch origin
git switch codex/ai-studio-deploy
npm ci
npm run test:billing
npm run test:studio
npm run dev
```

## Disponível nesta entrega

- Estúdio IA em menu próprio entre Catálogo e Assets, com a permissão existente `products.manage_images`.
- Billing: Starter R$ 899/mês e Pro R$ 1.199/mês; cadastro de cartões, contratação, cartão padrão, troca de plano e cancelamento de renovação, via Asaas no servidor. O cliente vê apenas UP Zero.
- Previsão dos adicionais: WhatsApp R$ 99/número conectado e Estúdio R$ 10/pacote de quatro fotos. Detalhamento por número e ensaio, separado de faturas efetivamente emitidas.
- Migração aditiva de Billing em `db/migrations/003_platform_billing.sql`, aplicada ao banco configurado durante o desenvolvimento. Para outro banco, executar `node --import tsx scripts/billing-migrate.ts`.

## O que ainda precisa de configuração/desenvolvimento

### Billing

Veja `docs/billing.md` e `.env.example`. Configurar `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT`, `BILLING_TOKEN_ENCRYPTION_KEY`, `ASAAS_WEBHOOK_TOKEN`, banco e webhook `/api/webhooks/billing`. Tokenização deve estar habilitada em produção. Primeiro homologar a integração no Sandbox; até aqui foram usados testes simulados e um teste de concorrência no banco, sem transações reais no gateway.

A coleta de dados do cartão exige HTTPS e tratamento adequado de logs/APM. Não registrar corpos de `/api/billing`. Tokens são cifrados; número completo e CVV não são persistidos. O vínculo com a liberação de módulos da plataforma e a inclusão automática de uso de WhatsApp/IA nas faturas **ainda não foram implementados**. Operações incertas mantêm trava para conciliação, sem nova cobrança automática.

### Estúdio IA

Versão final entregue em 17/09/2026:

- Seis poses básicas alternadas automaticamente por avatar e ângulo, com sequência persistida por loja. Refazer escolhe outra pose para o ângulo solicitado.
- Loader com etapa atual, contador de fotos prontas/restantes e barra baseada em entregas concluídas, não em estimativa de tempo. A análise tem indicador indeterminado.
- Sunburst fixado no servidor e sem seletor de qualidade. Novas tentativas de ensaios antigos também usam Sunburst; chamadas históricas permanecem intactas.
- Falhas de análise diferenciadas por limite de resposta, filtro, recusa, resposta vazia ou inválida. Consumo e request ID retornados são registrados também nessas falhas; nenhuma repetição automática é feita. Falhas antigas não têm diagnóstico recuperável. O limite permanece em 6.000 tokens.
- Validação: 24 testes do Estúdio e 15 de Billing aprovados; teste de Billing dependente de banco não executado nesta publicação. Testes com respostas simuladas, sem novas gerações pagas.


Atualização de 17/09/2026, prompt `garment-v10-natural-pose-original-skin`:

- Uma análise prévia das referências; palavras-chave de peças, conjunto, modelagem e estampa corrigíveis pelo usuário antes de gerar (inclusive saia versus calça).
- Frente e costas bastam; lateral pode ser estimada, com aviso. A cor vem das fotos reais da etapa 3; HEX serve somente para seleção/publicação.
- Três chamadas de imagem geram frente, costas e lateral; detalhe é recorte local 2:3. Sem conferência de IA após gerar. As quatro fotos ficam disponíveis para baixar; publicação exige aprovação humana.
- Avatar original priorizado como referência de pessoa, pele e cenário. Pose e expressão ficam livres para naturalidade; margens de topo/base permanecem padronizadas. Frente gerada guia apenas medidas de enquadramento.
- As instruções proíbem suavização/aperfeiçoamento de pele, mas não são uma máscara nem garantem fidelidade visual. Validar em fotos reais antes de liberar comercialmente.
- O pacote não tem teto financeiro de US$ 0,90: essa é uma referência comercial. Uso retornado pela API fica em `job.calls`; novas tentativas geram novo consumo.

Para testar no computador do Dev, criar `.env.local` a partir das variáveis de `.env.example`, configurar o backend habitual (`NEXT_PUBLIC_RUST_URL`) e inserir `OPENAI_API_KEY` somente nesse arquivo privado. Não usar prefixo `NEXT_PUBLIC_` na chave. Rodar `npm run dev` e, em outro terminal na mesma pasta, `npm run studio:worker`. Usar a conta habitual do Admin com permissão de gerenciar imagens. O worker lê a chave na inicialização: reiniciar depois de configurá-la. Não é preciso ter a chave para instalar, executar os testes simulados ou publicar o código.


**Não falta apenas a chave.** A versão atual usa arquivos privados e um worker contínuo. Ela funciona em desenvolvimento; produção precisa de host persistente compartilhado com o worker. A Vercel não executa essa arquitetura diretamente. A tela e a API ficam em preparação na Vercel até ser implementada uma adaptação de armazenamento e execução.

Caminhos possíveis: serviço separado com volume persistente, conectado ao Admin; ou migração para banco/armazenamento privado e fila gerenciada. Não usar `/tmp` para dados permanentes. Veja `docs/ai-studio.md`. No host apropriado: configurar `OPENAI_API_KEY`, `AI_STUDIO_DATA_DIR` e supervisionar `npm run studio:worker`. Não há endpoint remoto de worker pronto nesta entrega.

Fotos/avatares/ensaios locais em `.data` não são enviados para Git/Vercel. O avatar sintético Clara é um asset incluído no código. A migração dos ensaios locais deve ser feita separadamente após a definição do armazenamento.

### Vínculo dos números de WhatsApp

A mensageria existente usa `store_scope`. O Billing lê apenas o registro cujo identificador coincide com a loja autenticada. Foram encontrados dois números no cadastro 1043, sem correspondência com o cadastro da sessão usada no Billing. Confirmar a propriedade antes de corrigir o vínculo; não compartilhar o estado global da mensageria entre lojas. Não houve transferência de números entre lojas nesta entrega.

## Segredos e publicação

Nenhuma chave, token, `.env.local` ou dado privado do Estúdio é versionado. Compartilhar credenciais com o desenvolvedor por um canal seguro e configurá-las no ambiente de destino. Enviar chaves pelo Git não é necessário.

O deploy inclui apenas Billing, Estúdio e ajustes associados. Alterações locais de SuperFrete e WhatsApp que estavam em andamento não fazem parte desta entrega.
