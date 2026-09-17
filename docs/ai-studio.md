# Estúdio IA

## Fluxo atual: análise antes da geração (v12)

Esta seção substitui as menções abaixo à conferência automática após gerar. Novos ensaios executam uma análise Astra com as referências da roupa/cor e do avatar, produzindo observações da frente/costas, estimativas da lateral, invariantes, conflitos, cenário e instruções por ângulo. Não é necessário enviar foto lateral ou de detalhe. O gerador mantém qualidade alta e 1024×1536.

O worker faz três chamadas de geração para o pacote padrão e **nenhuma chamada de conferência posterior**. O detalhe é recortado localmente da frente numa região aproximada (parte superior, cintura ou inferior), planejada na análise e ajustável pelo usuário sem custo de API. Quatro chamadas pagas no caminho completo bem-sucedido: uma preparação + três gerações. Refazer um ângulo custa uma nova geração; não repete automaticamente a análise ou a conferência.

Outputs novos têm `reviewMode: manual`, ficam disponíveis para baixar imediatamente e não são marcados como aprovados pela IA. A aprovação humana continua necessária apenas para publicar no catálogo. As conferências de ensaios antigos são preservadas como histórico. Para testar a nova preparação completa com referências antigas, criar um novo ensaio com essas fotos.

O orçamento de US$ 0,90 é uma referência comercial, **não um limite imposto à API nem uma tarifa garantida**. A qualidade visual e o custo do novo prompt precisam ser medidos em testes reais. A análise de entrada não comprova que a imagem gerada está correta. Cada chamada concluída registra etapa, horário, modelo e uso retornado. Testes com respostas simuladas cobrem frente/costas + avatar, ausência de conferência, ZIP sem aprovação, recorte 2:3, refazer e preservação de resultados após falha parcial.

O Admin oferece `/ai-studio`, no menu Catálogo e na aba Imagens do formulário de produto. O recurso usa referências existentes do catálogo ou uploads privados, uma cor alvo e opcionalmente um avatar da biblioteca da loja. Não altera preços, estoque, variantes nem remove fotografias existentes.

## Executar localmente

```sh
npm run dev
npm run studio:worker
```

`npm run dev:local` também inicia o worker junto com os outros serviços do workspace. A chave `OPENAI_API_KEY` é lida dos arquivos de ambiente pelo servidor e pelo worker, nunca enviada ao navegador. Se a chave mudar, reinicie o worker.

Modelos: `gpt-6-astra` para análise e conferência; `gpt-image-2.5-sunburst` ou `gpt-image-2.5-flare` para edição, uma foto por chamada, qualidade high e 1024×1536. O modelo de análise pode ser configurado por `AI_STUDIO_ANALYSIS_MODEL`. As imagens originais são sempre enviadas junto da ficha, com papéis explícitos para roupa, cor, avatar e imagem gerada.

## Fluxo original (histórico; substituído pelas revisões v7–v12)

1. Escolher um produto/grupo ou enviar referências sem produto. Marcar o papel de cada foto: frente, costas, lateral, detalhe ou cor real. Limite de oito referências por ensaio, JPG/PNG/WebP estáticos, até 8 MB cada. As imagens são normalizadas, removendo metadados.
2. Definir nome da cor e tom aproximado. Uma referência de cor real tem prioridade, mas iluminação e balanço de branco ainda afetam a fidelidade. Para usar apenas a região de tecido, enviar a referência já recortada.
3. Manter o modelo/manequim original ou selecionar um avatar cadastrado. A biblioteca inicia vazia: cadastrar imagens sintéticas ou licenciadas previamente aprovadas, com nome e autorização de uso. Não existem identidades fictícias apresentadas como fotos já homologadas.
4. Solicitar análise. O worker produz uma ficha estruturada e identifica os ângulos efetivamente visíveis. Fotos de costas/lateral podem ser geradas mesmo sem uma referência correspondente, com aviso de que os detalhes ocultos serão estimados. É possível testar somente frente. Corrigir referências pelo botão “Novo ensaio com estas fotos”.
5. Solicitar geração após revisar a ficha. Cada ângulo tem sua própria chamada de edição e conferência. A imagem recebida é persistida antes da conferência: falhas de análise não perdem a geração paga. Não há repetição automática de chamadas pagas.
6. O detalhe é um recorte real da frente, sem nova geração. Se a região identificada não for válida, o usuário pode ajustar o recorte. Recriar a frente invalida seu recorte anterior. A aprovação humana é individual; rejeições automáticas por alteração da roupa bloqueiam aprovação/publicação.
7. Baixar imagens ou adicionar as aprovadas ao produto. Ensaios iniciados por upload podem receber um destino posteriormente. A publicação valida novamente a loja, o grupo e as variantes, preserva a galeria e a capa existentes, e acrescenta as fotos na ordem frente, costas, lateral, detalhe. Com galeria vazia, a primeira foto publicada torna-se principal. A ordenação/capa pode ser ajustada no editor existente.

Produtos com agrupamento `product` recebem as fotos na galeria geral, sem vincular IDs de variantes. Agrupamentos por atributos ou SKU recebem as fotos no grupo selecionado. O Estúdio não muda essa regra silenciosamente. A vitrine existente já seleciona a galeria por grupo/cor; não foi necessário alterar `next-upvitrine`. Confirmar propagação/cache na implantação real do backend.

## Persistência e implantação

Esta versão usa arquivos privados em `.data/ai-studio` durante desenvolvimento. Em produção, **`AI_STUDIO_DATA_DIR` é obrigatório** e deve apontar para um volume persistente local, visível ao servidor web e ao worker, com o mesmo usuário/permissões. O diretório contém referências e imagens JPEG, registros JSON de ensaios/avatares, reservas de uso e heartbeat. Incluir esse volume no backup; não servir como diretório público.

Executar o worker como processo supervisionado, no mesmo host/namespace de processos do servidor. Implantar o checkout e suas dependências, incluindo `scripts/ai-studio-worker.ts`, `lib/ai-studio`, `tsx`, `sharp`, `@next/env` e `zod`. O worker é um processo separado e não é um entrypoint incluído automaticamente no bundle standalone do Next. Use Node compatível com o Next instalado (verificado localmente com Node 25).

Esta implementação não é uma fila distribuída para Vercel/Lambda, discos efêmeros ou réplicas em hosts diferentes. Antes desse tipo de implantação, migrar os registros/transações para banco, mídias para armazenamento privado e execução para uma fila gerenciada. Não apontar múltiplos hosts para esta fila em disco.

Locks usam criação exclusiva de diretório e identificam seu processo proprietário; locks órfãos são recuperados quando é possível comprovar que o processo morreu no mesmo host. Jobs em processamento sem atualização por 20 minutos ficam em falha e exigem ação do usuário. Isso evita repetir automaticamente uma geração cujo resultado/cobrança é incerto. Cancelamento está disponível antes de o worker iniciar. SIGTERM aguarda a chamada atual; configurar tolerância de encerramento adequada.

Limites por loja: até três trabalhos pendentes, três tentativas de análise por ensaio e nove fotos solicitadas por ensaio. Reservas diárias padrão: `AI_STUDIO_DAILY_IMAGES=24`, `AI_STUDIO_DAILY_ANALYSES=40`, reiniciadas em UTC. Conferências contam como análises. Reservas não são devolvidas automaticamente em falhas ou cancelamentos; são limites conservadores, não um extrato financeiro. O custo monetário exato não é estimado nesta versão; o uso retornado pela OpenAI e os IDs de requisição são registrados nos ensaios. Consultar faturamento do projeto OpenAI para valores cobrados.

## Segurança e contratos do catálogo

- Sessão administrativa validada em `/admin/me`, com `products.manage_images`. Tokens locais assinados só são aceitos diretamente pelo Estúdio fora de produção. Não há fallback para claims de JWT sem verificação quando há falha de autenticação.
- Loja deriva da sessão; mídia, jobs e avatares usam IDs UUID dentro do diretório daquela loja. Nenhum token do administrador é persistido na fila.
- Mutações exigem origem correspondente ao host. Proxy de implantação deve preservar o Host público.
- Fotos importadas precisam constar no produto validado. Download aceita somente HTTPS, resolve e fixa endereço IPv4 público, revalida redirecionamentos, limita tamanho/tempo e não encaminha cookies.
- Uploads e geração permanecem privados até ação explícita de publicação. Publicação usa `/storage/upload` e `POST /products/:id/images`, com `image_key`, `variant_ids` e itens `{url, display_order, is_primary}`. `GET /products/:id/full` precisa incluir loja, variantes, regra e grupos de imagens.
- URLs enviadas ao catálogo são persistidas antes de anexar. Em nova tentativa, a galeria é consultada para evitar anexação duplicada após resposta de rede incerta. Isso pressupõe leitura consistente do backend após a gravação; para garantias entre sistemas, o backend deve oferecer uma chave de idempotência própria.

## Validação

```sh
npm run test:studio
npx eslint lib/ai-studio components/admin/ai-studio app/ai-studio 'app/api/ai-studio/[...path]/route.ts' scripts/ai-studio-worker.ts tests/ai-studio.test.ts
```

Os testes usam respostas simuladas da OpenAI e do backend. Verificam validação, isolamento entre lojas, referências ausentes, segurança de URLs, recorte real, persistência após falha, concorrência de gravação, limites de uso, aprovação e publicação idempotente após resposta incerta. Não medem fidelidade visual dos modelos. A disponibilidade dos três modelos foi consultada com a chave do projeto, sem geração de imagens nesse teste de acesso.

Antes de liberar comercialmente, avaliar peças reais: lisas, estampadas, bordadas e tecidos complexos, comparando recoloração e troca de avatar separadamente. A análise e a revisão automática não garantem identidade perfeita da roupa, precisão colorimétrica nem ausência de artefatos de pele.


### Fluxo revisado (14/09/2026)
Produto e grupo → fotos existentes/construção → cores cadastradas da loja → até quatro uploads da cor real (manequim/still) → avatar → análise e geração. Nome herdado do produto. Todas as cores exigem ao menos uma referência fotográfica na etapa 3. Galerias compartilhadas não permitem inferir fotos por cor. Clara é um avatar inteiramente sintético incluído em `assets/ai-studio/avatar-clara.jpg`, disponível em todas as lojas sem copiar dados entre clientes. Até oito referências de construção e quatro de cor são aceitas; as fotos de cor orientam o tom; ângulos não documentados são estimados e sinalizados para revisão.


### Referências parciais
A ausência de foto de costas ou lateral não bloqueia mais a geração. Com análise concluída e ao menos uma referência da roupa, todos os ângulos selecionados podem ser solicitados. `verifiedAngles` mantém separados os ângulos comprovados dos estimados. A interface avisa sobre o risco antes de gerar, e a conferência marca vistas estimadas para revisão humana, mesmo quando o modelo retorna `pass`. Contradições visíveis e defeitos reais continuam sujeitos a reprovação. Esta regra também se aplica a ensaios existentes.

Comparação original/resultado sempre aberta em todos os ângulos; sem original correspondente, mostra uma referência disponível identificada. HEX e nome da variante são metadados de seleção/publicação, nunca fontes do tom da geração ou da conferência. Fotos da etapa 3 são obrigatórias, inclusive ao refazer imagens.

O botão “Baixar Imagens” exporta todas as imagens geradas do ensaio em ZIP (inclusive já publicadas), com nomes de produto/cor/ângulo. A rota de download exige autenticação e valida a loja por meio do registro privado do ensaio.

Sem referências da peça na etapa 1, o usuário pode gerar com avatar selecionado e fotos da etapa 3. Nesse modo, as fotos da etapa 3 definem tanto a construção da roupa quanto a cor, enquanto o avatar define somente identidade e proporções da pessoa. Ângulos sem comprovação continuam sinalizados para revisão.

Frente, costas e lateral usam composição vertical 1024×1536, com alvo de 5% de margem no topo e na base. A frente gerada não reprovada serve de referência de escala/enquadramento para as outras vistas. A conferência sinaliza divergências acima de 2% e reprova enquadramento claramente incompatível. A regra não altera proporções anatômicas nem se aplica ao detalhe. Imagens anteriores não são reenquadradas automaticamente.


### Identificação corrigível da roupa (v8)
A análise prévia extrai palavras-chave de peças, composição (peça única/conjunto), modelagem e estampa. O usuário pode corrigir esses campos e adicionar até 1.500 caracteres de orientação na página da análise. Salvar não chama a IA nem consome uma tentativa de geração. Análises antigas usam rótulos extraídos localmente da descrição existente, com campos desconhecidos identificados.

A ação autenticada `update_guidance` persiste a orientação por loja, autor, data e revisão, e é recusada enquanto o ensaio está em processamento. Correções substituem a descrição e o plano automático no prompt para não manter uma classificação conflitante (saia/calça). Fotografias continuam definindo detalhes visíveis, cor e avatar. Nenhum pós-processamento pago é adicionado.

Cada nova foto recebe a revisão da orientação usada; fotos anteriores não são modificadas. Uma frente de outra revisão não é reutilizada como referência de costas/lateral. A interface informa quando a imagem antecede a correção e exige salvar/cancelar o formulário antes de gerar/refazer. Aprovação humana para publicar continua separada de download. Estas instruções reduzem erros, sem garantir fidelidade da geração.


### Preservação do avatar original (v9)
O pedido de geração passa a ser uma edição da roupa sobre a fotografia original do avatar. A referência do avatar no ângulo solicitado é enviada primeiro; sem esse ângulo, usa a frente original, mantendo a possibilidade de estimar outras vistas. As fotos da etapa 3 também respeitam seus rótulos de ângulo na ordenação. Todas as referências originais continuam presentes.

A frente gerada serve somente para medidas de composição (escala, margens e base dos pés), nunca como fonte de rosto, pele ou iluminação. A análise descreve textura e contraste observados sem recomendar aperfeiçoamento. Uma instrução final de preservação prevalece sobre sugestões estéticas do plano: sem suavização, uniformização de tom, rejuvenescimento, alteração da luz sobre a pele ou aplicação de poros artificiais.

Não há máscara, composição de pixels originais ou garantia de pele idêntica: regiões antes cobertas e novos ângulos ainda exigem síntese. A alteração é de seleção de referências e instruções, com validação visual pendente em uma nova geração. Não modifica fotos já prontas. Mantém os modelos, qualidade, resolução e quantidade de chamadas (uma análise prévia e três gerações; detalhe local), sem conferência paga posterior. Os testes com respostas simuladas verificam os bytes do avatar enviados como base, os ângulos, a política de enquadramento e a ausência de chamadas adicionais.


### Alternância de poses (v11)
Seis poses discretas de catálogo alternam automaticamente por loja, avatar e ângulo. A seleção ocorre no servidor, sob a trava da loja, antes de enfileirar a geração. O arquivo privado `pose-sequences.json` mantém a sequência; `job.poseIds` registra a escolha e `job.calls[].poseId` registra a pose solicitada em cada chamada concluída. Refazer avança somente os ângulos solicitados e evita repetir a pose anterior daquele ensaio. Uma reserva interrompida pode pular uma posição, sem repetição automática de geração paga.

Frente, costas e lateral recebem orientações específicas, preservando vista, enquadramento e detalhes da roupa. Mãos não devem cobrir a peça, inventar bolsos ou puxar o tecido. A frente gerada não é referência de pose. O recorte de detalhe continua local. Ensaios antigos na fila recebem uma opção determinística; o próximo pedido do usuário passa a reservar a sequência persistente. Não há nova chamada de IA para escolher poses; adesão visual às instruções continua sujeita ao modelo.


### Diagnóstico, progresso e Sunburst fixo (v12)
Novos pedidos e novas tentativas usam sempre `gpt-image-2.5-sunburst`, inclusive ao refazer um ensaio antigo de Flare. O seletor de qualidade foi removido; qualidade da API continua `high`. O schema aceita o nome antigo para compatibilidade, mas o normaliza para Sunburst. Registros históricos de chamadas não são alterados.

Respostas de análise incompletas, vazias, recusadas ou fora do schema geram mensagens distintas. O worker persiste em `job.calls` o uso retornado, request ID, modelo, etapa, limite de saída, status e código de falha. Não armazena resposta parcial, texto de recusa ou raciocínio. Falhas de transporte/HTTP sem resposta de uso continuam sem consumo mensurável localmente. Ensaios antigos sem diagnóstico não podem ser reconstruídos retroativamente. O limite continua em 6.000 tokens, incluindo raciocínio; não foi elevado e nenhuma nova tentativa é automática.

`job.generationProgress` registra as fotos desta solicitação, as concluídas e a etapa atual. A interface mostra spinner, contador e estados de frente, detalhe, costas e lateral. Refazer reinicia a contagem só para os ângulos solicitados. O detalhe conta quando o recorte está salvo. A barra representa fotos prontas, não tempo estimado nem andamento interno do provedor. A análise usa um indicador indeterminado. A interface consulta o estado a cada cinco segundos enquanto visível.
