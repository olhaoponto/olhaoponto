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
