# Plano de implementação — Olha o Ponto

## Escopo

Criar um aplicativo mobile Expo/React Native com TypeScript para Android e iPhone, com login por e-mail, quatro batidas diárias, cálculo ao vivo e bloqueio do limite de 10:00 horas trabalhadas, almoço descontado, alertas locais graduais, modo offline, espelho de ponto, resumo mensal/semanal, exportação, perfil/LGPD e administração de contas. O trabalho também inclui schema e RLS no Supabase existente, Edge Functions administrativas, biblioteca local de charges, testes Jest, documentação em português e preparação para Expo Go e APK via EAS.

## Abordagem técnica

Será preservado o starter Mobile Dev instalado, com Expo Router, React Native e TypeScript, bem como os identificadores nativos, o scheme, o slug e as portas 8081/3000. O Supabase existente será a fonte de verdade para autenticação, perfis, batidas e preferências. O app usará `@supabase/supabase-js` e lerá a URL/chave pública somente de `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`; `.env` ficará ignorado pelo Git e `.env.example` conterá valores demonstrativos. A service role ficará exclusivamente no ambiente das Edge Functions. A API/Drizzle que acompanha o starter será mantida para a infraestrutura de Preview, mas não será usada como armazenamento das informações de ponto.

A lógica de jornada, intervalo, projeção de saída, limites, retroatividade, alertas e totais será isolada em funções puras. O estado local persistido manterá dados necessários ao uso offline e uma fila de sincronização; o Supabase aplicará RLS para cada usuário. Datas serão exibidas em `America/Bahia` e salvas como timestamps UTC. Notificações locais serão recalculadas após registros/edições, pausadas no almoço e escalonadas conforme os marcos definidos no documento. Se a confirmação do alerta crítico chegar depois do limite, o app pedirá confirmação e gravará a saída no último horário permitido, com justificativa, sem persistir total acima do teto. As limitações do Expo Go e diferenças de permissões/alarmes no APK serão descritas no README.

O usuário confirmou desativar somente o cadastro público no Supabase Auth, mantendo a API acessível ao app e protegendo os dados com RLS. O login por e-mail e senha permanecerá habilitado. O aceite inicial de Termos/Privacidade será registrado; o primeiro acesso após cadastro administrativo exigirá troca da senha provisória. As Edge Functions `admin-create-user`, `admin-reset-password`, `admin-set-user-status` e `delete-account` validarão identidade e papel no servidor, sem expor a service role. O schema e as políticas ficarão versionados em `supabase/migrations`; as funções serão mantidas em `supabase/functions`.

As telas seguirão as imagens conceituais aprovadas. A biblioteca conterá pelo menos 15 variações de charges em Reanimated/SVG, sem downloads externos e sem repetir a charge consecutivamente. O espelho permitirá edição/exclusão com confirmação e exportação PDF; o perfil terá exportação JSON/CSV e exclusão da conta; administração gerenciará acessos sem ler batidas de terceiros. O pacote está preparado para Expo Go e APK via `eas.json`. O projeto EAS `edingtonmaquine/olhonoponto` foi criado e associado a este app pelo `projectId` `97f93ccd-6d20-4ebd-9b52-f9bb7e4ab41a`. O repositório GitHub público `olhaoponto/olhaoponto` está conectado somente a esse projeto, após autorização específica; os projetos Expo `vivacondo` e `herois-plus-app` não foram acessados nem modificados. A geração do APK ainda depende de variáveis no ambiente remoto `preview` e de disparar/acompanhar a build. O README documentará instalação, variáveis, migrações, primeiro administrador, testes e build. Os testes Vitest cobrem os cálculos, almoço, projeções, níveis de alerta, bloqueios, horários manuais, virada de dia e totais mensais.

## Estrutura prevista

| Pasta | Responsabilidade |
| --- | --- |
| `app/` | Rotas Expo Router para splash, autenticação, Hoje, Espelho, Resumo, Perfil, Sobre, Administração e modais/overlays. |
| `components/` | Contador, cartões, linha do tempo, barra de progresso, mascote, charges, formulários, modais e estados de erro/vazio. |
| `hooks/` | Sessão, batidas, relógio ao vivo, notificações, preferências e sincronização offline. |
| `services/` | Cliente Supabase, autenticação, perfis, batidas, exportação e agendamento local. |
| `store/` | Zustand e persistência de preferências, estado da sessão e fila local. |
| `utils/` | Cálculo de jornada, regras de bloqueio, datas/fuso, projeções, alertas e totais. |
| `theme/` e `assets/` | Tokens claro/escuro, tipografia, ícone/splash, mascote, sons e recursos locais. |
| `supabase/` e `tests/` | Migrações, RLS, Edge Functions e testes Jest da lógica pura. |

## Direção visual aprovada

A identidade combina um utilitário de produtividade acolhedor com um mascote de relógio e as telas aprovadas. A Home dá prioridade ao tempo trabalhado, tempo restante e próxima batida; as demais informações aparecem em cartões curtos e navegação inferior consistente. Azul-petróleo e turquesa comunicam confiança; amarelo sinaliza atenção; coral/vermelho é reservado aos alertas finais. O fundo claro amplo, cantos arredondados, sombras suaves, boa área de toque e contraste permanecem consistentes também no modo escuro.

O mascote relógio sorridente, o arco de progresso que muda de cor conforme o limite se aproxima e os banners de alerta são os elementos de assinatura. Inter será a fonte principal com fallback do sistema; os números de tempo terão destaque forte e os textos auxiliares permanecerão legíveis. Microinterações e feedback tátil serão discretos durante a jornada normal e mais intensos nos níveis finais. A voz será clara, bem-humorada e protetora, por exemplo: “Seu tempo, mais em dia.” e “Jornada normal completa. A partir daqui é hora extra!”.

## Correções pós-instalação da primeira APK

Após o teste da primeira APK, priorizar a confiabilidade da sessão Supabase: usar a sessão retornada pelo login como fonte de verdade, restaurá-la de forma segura quando necessário e não navegar para Termos, Home ou ações protegidas sem uma sessão válida. O aceite deve gravar versão e data/hora no perfil do mesmo usuário autenticado; batidas automáticas/manuais e troca de senha devem usar essa sessão e apresentar uma instrução clara de reautenticação se ela realmente expirou. O fuso/horário manual nunca substitui autenticação.

Espelho e Resumo devem encerrar o carregamento em todos os caminhos, inclusive sessão ausente, falha inesperada e mudança de mês; apresentar erro recuperável com tentativa novamente e diferenciar indisponibilidade/cache de um mês realmente sem registros. Manter o uso das políticas RLS existentes sem alterar os dados do administrador nem conceder acesso ampliado.

Complementar os alertas locais com um lembrete de pausa ao completar 4 horas trabalhadas se o almoço ainda não tiver começado, preservar os níveis existentes de 8 a 10 horas e ativar o lembrete de retorno após a duração de almoço configurada. Recalcular/cancelar as notificações após batidas, edições, preferências ou logout. Moderar as animações e textos dos alertas para um tom mais sóbrio, sem alterar o limite rígido de 10:00 nem o botão crítico de saída.

Na tela Sobre, declarar expressamente que o app acompanha apenas registros pessoais do ponto da empresa e não substitui o registro original/oficial, identificar o criador como Marcos Henrique Edington Santos e manter o aviso informativo sobre a jornada. A APK corrigida deve incrementar o versionCode Android para instalar sobre a APK anterior.

## Repositório e entrega

O projeto Mobile Dev mantém seu repositório canônico gerenciado e não permite trocar o canônico para GitHub. Uma cópia do código está no repositório público existente `olhaoponto/olhaoponto`, publicado após confirmação explícita e preservando o arquivo preexistente; não foi criado outro repositório nem usado force-push. O projeto Expo EAS conecta somente a esse repositório, sem acesso aos projetos Expo `vivacondo` e `herois-plus-app`. O `.env` e qualquer credencial são excluídos do Git e do ZIP. A entrega inclui ZIP para VS Code, README em português, código, `.env.example` e configuração de build.


## Melhorias solicitadas em novembro de 2026

### Escopo funcional aprovado

1. Corrigir a edição de batidas no Espelho para que Salvar persista e atualize a tela; garantir que campos e ações permaneçam acessíveis quando o teclado estiver aberto; e impedir qualquer rota protegida de renderizar sem sessão Supabase válida, inclusive após Voltar na tela de login.
2. Adicionar saldo de banco de horas externo sem substituir o saldo estimado pelo aplicativo. O saldo total será a soma das horas extras calculadas pelo aplicativo em todo o histórico com lançamentos externos manuais. Cada ajuste terá sinal (crédito/débito), motivo e data; os ajustes ficarão auditáveis e sujeitos a RLS do próprio usuário. Os dados antigos permanecem intactos.
3. Configurar no Perfil uma ou mais jornadas com nome, início, fim, duração do almoço e dias da semana, com seleção da jornada ativa. A jornada inicial padrão será 08:00–18:00, almoço de 60 minutos, de segunda a sexta; não muda o teto rígido de 10:00 trabalhadas. O alerta de conclusão usa o horário final fixo configurado para o dia selecionado, independentemente de atraso na entrada. O retorno do almoço usa o horário real da saída para almoço + duração configurada e alerta cinco minutos antes.
4. Em Hoje, liberar orientação paisagem apenas quando essa rota estiver ativa e mostrar então uma visualização ampla dedicada ao contador ao vivo; esconder o restante da tela e a barra de abas nessa orientação. Manter as demais telas em retrato. A visualização continua mostrando jornada em andamento/pausa/encerrada e o tempo trabalhado.

### Persistência e integrações

As jornadas e a antecedência do aviso ficarão na coluna JSONB de preferências já existente no perfil, preservando compatibilidade com perfis atuais e sem mudar os dados de terceiros. O banco de horas externo usa a tabela versionada `balance_adjustments`, com RLS e acesso do próprio usuário. Após autorização explícita, a migração foi aplicada somente ao projeto Supabase existente `duqytmwhlrjqduzscgpa`, sem apagar nem reescrever dados existentes; o histórico remoto registra `20261107152710 / balance_adjustments`.

### Limites de execução

Trabalhar somente na cópia autorizada de `olhaoponto/olhaoponto`; não criar repositório, projeto Supabase nem projeto Expo. O usuário autorizou posteriormente a aplicação desta migração, o envio da branch de trabalho ao repositório existente e a criação de uma nova APK para teste. Preservar package/bundle ID, projectId EAS, scheme e credenciais existentes; nunca ler ou incluir `.env`/segredos no código ou nos artefatos.


## Correções e navegação solicitadas em novembro de 2026

1. Jornada padrão: manter uma única jornada ativa de segunda a sexta, 08:00–18:00 e 60 minutos de almoço de segunda a quinta; sexta-feira 08:00–17:00 com o mesmo almoço por meio de uma exceção de horário dentro da jornada. Resolver automaticamente o horário aplicável por dia, sem criar uma jornada padrão independente de sexta e sem alterar jornadas personalizadas. Unificar em memória os dois registros padrão gerados pela versão anterior, preservar a configuração personalizada e encaminhar o ID ativo antigo para a jornada unificada.
2. Banco de horas: tratar explicitamente inicialização de sessão, sessão ausente, falha de rede e consulta travada, encerrar o indicador em todos os caminhos e descartar resultados de tentativas obsoletas. Exibir erro recuperável, permitir tentar novamente e colocar retorno ao Resumo e inclusão do saldo em posições visíveis. Não alterar schema, migrações ou dados do Supabase.
3. Login/teclado: ajustar o contêiner rolável para a janela que encolhe quando o teclado Android abre e manter ajuste no iOS. Substituir o texto de mostrar/ocultar senha por controle acessível de olho/olho riscado.
4. Rotação: guardar `rotacao_contador` na preferência JSON existente, habilitada por padrão para compatibilidade; quando desativada, manter a orientação retrato mesmo se o usuário girar o aparelho. Limitar paisagem à tela Hoje e mostrar o controle junto a som, vibração, notificações e biometria.
5. Navegação: esconder a barra inferior próxima aos controles do aparelho; mostrar o cartão HOJE | ESPELHO | RESUMO abaixo da saudação/data em Hoje e nas páginas principais relacionadas, inclusive Banco de horas. Destinar o botão Hoje a `/(tabs)` (rota index do grupo, não `/(tabs)/index`) e retirar botões de retorno redundantes. A rota Perfil permanece acessível pelo avatar superior direito, cujo menu oferece Perfil, Agenda e Sair; preservar o fluxo de sincronização pendente no logout.
6. Limite de execução da entrega anterior: branch existente `work/improvements-nov-2026`; não atualizar `main`. A nova solicitação de 07/11/2026 passa a autorizar uma build APK de teste após validação; o estado de Supabase para os status de dia será solicitado separadamente antes de qualquer migration. Compartilhar almoço usa o seletor nativo e exige confirmação do usuário; não consultar contatos nem enviar automaticamente.


## Novas melhorias solicitadas em 07/11/2026

### Prioridade e estrutura de navegação

1. Corrigir primeiro o caminho de Hoje no Expo Router: a rota index do grupo é `/(tabs)`, não `/(tabs)/index`. Centralizar os destinos da navegação superior com `Href` tipado; oferecer o cartão HOJE | ESPELHO | RESUMO nas telas principais e no Banco de horas. Retirar Perfil desse cartão sem remover a rota: todas as funções existentes de Perfil continuam disponíveis pela opção “Perfil” no avatar superior direito, junto às opções “Agenda” e “Sair”. Remover os botões “Voltar ao Hoje/Resumo” redundantes para que não haja caminhos quebrados. Manter tabs sem barra inferior.
2. Alterar somente os rótulos dos botões de marcação para “BATER - ENTRADA/SAÍDA/ALMOÇO/VOLTA DO ALMOÇO”, sem a palavra “PONTO”. O funcionamento/ordem das batidas continua idêntico.

### Jornada e recursos de apoio

3. Representar o padrão como uma jornada ativa única de segunda a sexta, 08:00–18:00, 60 minutos de almoço segunda–quinta e exceção interna de sexta 08:00–17:00/60 minutos. A interface deve mostrar explicitamente esse resumo dentro da jornada ativa. Guardar exceções por dia no JSONB existente; ao ler os dois registros padrão split da versão anterior, consolidá-los em memória e mapear um ID antigo de sexta para a mesma jornada principal. Preservar qualquer jornada realmente personalizada e a seleção de jornadas alternativas.
4. Criar em Hoje uma opção “Combinar almoço” para compartilhar agora a mensagem “Estou indo almoçar agora, se você precisar de algo me avise.” e compartilhar uma previsão de retorno calculada a partir do horário atual. Se o almoço já começou, usar a batida real de saída e somar a duração configurada; nunca exigir nem mostrar horário fixo de saída (por exemplo, 12:00). Abrir o seletor nativo de compartilhamento para o próprio usuário escolher contato e canal e confirmar o envio. Não ler contatos nem enviar mensagens automaticamente.
5. Criar missões semanais opcionais, lúdicas mas sem ranking ou sequência punitiva: reconhecer registros completos e revisão do espelho, e contar como resolvido qualquer dia corretamente indicado como trabalho, folga, falta ou atestado. Não premiar presença perfeita, quantidade de horas nem hora extra. Se o saldo versus escala estiver negativo, mostrar passos de regularização que começam por confirmar a regra/combinação com o RH; não prescrever compensação nem trabalho além da jornada configurada, pausas ou teto de 10h.
6. Aos sábados e domingos sem jornada prevista, perguntar “Você vai trabalhar hoje?” com escolhas de trabalhar ou descansar. Quando o usuário selecionar descanso, o contador não deve parecer uma jornada pendente: mostrar uma ilustração alegre de descanso (relógio/momento de praia ou cadeira) e nenhuma ação de bater ponto. Se escolher trabalhar, permitir o contador e usar a jornada ativa para aquela data. Permitir ainda marcar “Ausência” ou “Atestado” no dia corrente; esses status pausam metas e são dados pessoais, sem nota médica nem exposição a outros usuários.

### Persistência, privacidade e benchmark

7. A fila de status do dia será local/cacheada e sincronizada para a tabela nova `day_statuses`, com chave `(user_id,data)`, valores enumerados (`working`, `rest`, `absence`, `medical_leave`) e RLS rigorosa de próprio usuário ativo para todas as operações. Administradores não ganham acesso ao conteúdo dos status. A migration será somente aditiva e deverá ser autorizada/aplicada no Supabase existente antes de declarar a função sincronizada; nenhum dado será alterado/destruído.
8. Pesquisar Pontotel, Tangerino/Sólides, Oitchau, Ahgora e Jibble em fontes verificáveis. O benchmark encontrou como padrões documentados marcação simples, transparência dos registros/saldos, alertas operacionais e pedidos/justificativas digitais; as fontes abertas não documentaram gamificação de ponto. Usar essas observações como inspiração, documentar as fontes e não atribuir a concorrentes funções não verificadas nem copiar marca/conteúdo.
9. Preservar o projeto Expo e a branch existentes. Depois de validar as rotas e o conjunto funcional, enviar a mesma branch e iniciar apenas uma APK Android de teste pelo perfil `preview` do projeto `@edingtonmaquine/olhonoponto`; auto-incremento de versão já está configurado remotamente. Não publicar na loja nem alterar `main`.

### Retorno do almoço, menu da conta e Agenda (refinamento posterior)

10. Calcular o retorno exclusivamente pela batida real `saida_almoco` mais a duração do intervalo na jornada ativa. Exemplo: saída às 13:26 e almoço de 60 minutos → retorno 14:26; com aviso de 5 minutos, notificar às 14:21. Editar a batida deve recalcular o lembrete. Remover o campo de horário fixo e quaisquer textos que sugiram saída obrigatória às 12:00.
11. Manter as opções de antecedência 5, 10 e 15 minutos e permitir um número inteiro positivo personalizado, incluindo 2 minutos; salvar na preferência de alertas já existente e validar limite positivo antes de aceitar.
12. Usar o avatar superior direito como acesso persistente a Perfil, Agenda e Sair. Retirar somente a opção Perfil do cartão de navegação, sem apagar a rota nem remover configurações da tela Perfil.
13. Implementar Agenda de reuniões em calendários nativos sincronizados: selecionar calendários para importar/exibir reuniões, gravar em calendário com permissão de escrita, e editar/excluir eventos criados pelo app. Metadados de seleção e lembretes são separados por usuário no armazenamento local; títulos, detalhes e eventos não vão ao Supabase. Os lembretes de reunião usam tipo independente: recalcular notificações de jornada não cancela reuniões. Microsoft/Teams e Google dependem da sincronização previamente configurada no sistema do aparelho.

### Direção visual para os novos recursos

Reutilizar o sistema visual do Olha o Ponto (turquesa/azul-petróleo, cartões arredondados, Inter, mascote relógio e estados acessíveis). A área de desafio deve usar progresso claro, linguagem acolhedora e microfeedback positivo, sem ranking punitivo. O descanso deve se distinguir do estado de espera: cena colorida e calma, relógio com elementos de praia/espreguiçadeira, texto de descanso e opção discreta para corrigir a escolha.

## Correção da branch e Agenda sincronizada — 8 de novembro de 2026

Após identificar que uma implementação anterior partiu de uma revisão defasada, a mudança funcional é baseada exclusivamente na ponta remota `d07e955` da branch existente `work/improvements-nov-2026`; `4244e43` é o commit de código da APK indicada pela pessoa usuária e `3d187de` o commit documental posterior. A `main` permanece intacta. Não criar repositório, projeto Expo ou projeto Supabase, e não executar migrations nesta extensão.

A Agenda é para reuniões. No Android/iOS, `expo-calendar` lista os calendários expostos pelo provider nativo, permite que a pessoa escolha calendários sincronizados para importação e grava novas reuniões em calendário selecionado com permissão de escrita. Outlook/Microsoft 365/Teams e Google dependem de a conta estar sincronizada com o calendário do sistema; não coletar senhas nem implementar OAuth neste escopo. Seleções e metadados locais da Agenda são separados por usuário; reuniões ficam no provider/conta de calendário selecionada, sem serem enviadas ao Supabase. Notificações locais do app não devem cancelar nem substituir alertas de jornada.

Antes de salvar uma reunião, comparar o fim do evento com a projeção de horas trabalhadas até esse instante. Usar batidas reais do dia e respeitar o horário variável do almoço; sem saída registrada, comunicar uma faixa que cobre pausa configurada ou ausência de pausa. Para uma data futura sem entrada registrada, usar mediana de até cinco dias recentes (mínimo três) ou pedir entrada prevista. Se qualquer cenário passar de 10:00, mostrar aviso e pedir confirmação antes de salvar; permitir prosseguir após confirmação, pois o pedido é de aviso, não de bloqueio. Exibir avisos equivalentes para eventos importados quando a projeção for possível.

Nesta rodada, `pnpm check`, `pnpm test` (86 aprovados, 1 legado ignorado), `pnpm lint`, `git diff --check` e exportação Android local passaram. O commit de código `4e38020` foi enviado somente a `work/improvements-nov-2026`; a APK EAS `38ed8cd1-c044-4f1d-8255-15b6d68620af` concluiu em `Succeeded`, versão `1.0.1 (7)`, pelo perfil/ambiente `preview`, com auto-submit desmarcado e disponibilidade de 13 dias. Nenhuma migration foi aplicada, nenhuma loja foi acionada e `main` permaneceu no commit anterior.
