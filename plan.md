# Plano de implementação — Olha o Ponto

## Escopo

Criar um aplicativo mobile Expo/React Native com TypeScript para Android e iPhone, com login por e-mail, quatro batidas diárias, cálculo ao vivo e bloqueio do limite de 10:00 horas trabalhadas, almoço descontado, alertas locais graduais, modo offline, espelho de ponto, resumo mensal/semanal, exportação, perfil/LGPD e administração de contas. O trabalho também inclui schema e RLS no Supabase existente, Edge Functions administrativas, biblioteca local de charges, testes Jest, documentação em português e preparação para Expo Go e APK via EAS.

## Abordagem técnica

Será preservado o starter Mobile Dev instalado, com Expo Router, React Native e TypeScript, bem como os identificadores nativos, o scheme, o slug e as portas 8081/3000. O Supabase existente será a fonte de verdade para autenticação, perfis, batidas e preferências. O app usará `@supabase/supabase-js` e lerá a URL/chave pública somente de `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`; `.env` ficará ignorado pelo Git e `.env.example` conterá valores demonstrativos. A service role ficará exclusivamente no ambiente das Edge Functions. A API/Drizzle que acompanha o starter será mantida para a infraestrutura de Preview, mas não será usada como armazenamento das informações de ponto.

A lógica de jornada, intervalo, projeção de saída, limites, retroatividade, alertas e totais será isolada em funções puras. O estado local persistido manterá dados necessários ao uso offline e uma fila de sincronização; o Supabase aplicará RLS para cada usuário. Datas serão exibidas em `America/Bahia` e salvas como timestamps UTC. Notificações locais serão recalculadas após registros/edições, pausadas no almoço e escalonadas conforme os marcos definidos no documento. Se a confirmação do alerta crítico chegar depois do limite, o app pedirá confirmação e gravará a saída no último horário permitido, com justificativa, sem persistir total acima do teto. As limitações do Expo Go e diferenças de permissões/alarmes no APK serão descritas no README.

O usuário confirmou desativar somente o cadastro público no Supabase Auth, mantendo a API acessível ao app e protegendo os dados com RLS. O login por e-mail e senha permanecerá habilitado. O aceite inicial de Termos/Privacidade será registrado; o primeiro acesso após cadastro administrativo exigirá troca da senha provisória. As Edge Functions `admin-create-user`, `admin-reset-password`, `admin-set-user-status` e `delete-account` validarão identidade e papel no servidor, sem expor a service role. O schema e as políticas ficarão versionados em `supabase/migrations`; as funções serão mantidas em `supabase/functions`.

As telas seguirão as imagens conceituais aprovadas. A biblioteca conterá pelo menos 15 variações de charges em Reanimated/SVG, sem downloads externos e sem repetir a charge consecutivamente. O espelho permitirá edição/exclusão com confirmação e exportação PDF; o perfil terá exportação JSON/CSV e exclusão da conta; administração gerenciará acessos sem ler batidas de terceiros. O pacote está preparado para Expo Go e APK via `eas.json`; a geração do APK real depende de uma conta Expo/EAS autenticada e das variáveis do ambiente remoto. O README documentará instalação, variáveis, migrações, primeiro administrador, testes e build. Os testes Vitest cobrem os cálculos, almoço, projeções, níveis de alerta, bloqueios, horários manuais, virada de dia e totais mensais.

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

## Repositório e entrega

O projeto Mobile Dev mantém seu repositório canônico gerenciado e não permite trocar o canônico para GitHub. Uma cópia do código poderá ser enviada ao repositório existente `olhaoponto` usando o conector autorizado; como o destino é público, o push ficará pendente de confirmação explícita da pessoa usuária e qualquer conteúdo existente será preservado, sem criar outro repositório nem usar force-push. O `.env` e qualquer credencial serão excluídos do Git e do ZIP. A entrega inclui ZIP para VS Code, README em português, código, `.env.example` e configuração de build.
