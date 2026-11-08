# Olha o Ponto

Aplicativo mobile Expo/React Native + TypeScript para acompanhar os próprios horários registrados no ponto da empresa, pausar o contador durante o almoço e receber alertas locais antes do limite diário de trabalho. O app é um controle pessoal; não substitui o relógio, sistema ou registro oficial de ponto do empregador. Idealizado e criado por Marcos Henrique Edington Santos.

## Almoço, Agenda e conta

- O retorno do almoço é calculado somente depois da batida real de saída: hora registrada + duração do intervalo da jornada ativa. O aviso usa a antecedência escolhida (5, 10, 15 minutos ou um valor personalizado entre 1 e 180), sem horário fixo para sair.
- A Agenda permite selecionar calendários sincronizados pelo sistema do aparelho, importar reuniões, criar reuniões em calendários graváveis e receber lembretes locais do app. O Outlook/Microsoft 365 (incluindo calendário usado pelo Teams) e o Google Calendar aparecem somente quando a conta e a sincronização nativa estão habilitadas no Android/iOS; o app não pede senha nem implementa login OAuth próprio. Em aparelhos Android, confira no Outlook a opção de sincronizar calendário com o calendário padrão do dispositivo.
- Os eventos são lidos/criados no provider de calendário do aparelho e ficam sob controle da conta de calendário escolhida; a seleção de calendários e metadados de lembretes ficam separados por usuário no armazenamento local. Títulos, detalhes e eventos não são enviados ao Supabase. O logout remove metadados locais do app, mas não exclui reuniões já gravadas no calendário pessoal do sistema.
- Antes de gravar uma reunião, a Agenda verifica o total de horas até o fim do evento, descontando batidas reais de almoço. Sem saída registrada, apresenta a faixa entre o cenário com pausa possível e sem pausa; para datas futuras, usa a mediana das cinco entradas recentes (mínimo três dias) ou pede ao usuário uma entrada prevista. Se houver risco de passar de 10h, mostra alerta de confirmação, mas não bloqueia a reunião.
- O avatar no canto superior direito abre o menu Perfil, Configurações e Sair do Sistema. Perfil contém dados e segurança da conta; Configurações contém jornada, limites, almoço, alertas, aparência e biometria.
- A navegação principal é `HOJE | ESPELHO | RESUMO | AGENDA`, nessa ordem, em todas as telas principais.

## Abertura com o mascote

- Depois de qualquer autenticação bem-sucedida (sessão já existente, login, troca obrigatória de senha ou aceite inicial dos termos), antes de Hoje, o app mostra uma tela com o relógio mascote, uma frase local, barra de progresso e fechamento automático após cerca de 11,5 segundos. A pessoa também pode continuar imediatamente.
- A cada abertura, a frase é escolhida entre mensagens originais em português do Brasil e não repete a mensagem anterior do mesmo usuário; o histórico mínimo da última mensagem fica no armazenamento local. As frases são sazonais (neutro, Natal, Ano Novo, Carnaval e Festa Junina), não são copiadas do Vita MahJong e não requerem conexão de rede. As imagens ficam em `assets/images/mascot/`.
- Antes do login, o splash nativo apresenta o mascote junto ao nome “Olha o Ponto”, mantendo o ícone, as cores e os identificadores existentes.

## Tecnologia e estrutura

- Expo SDK 57 / React Native / Expo Router / TypeScript.
- Supabase Auth, Postgres, RLS e Edge Functions; projeto existente `duqytmwhlrjqduzscgpa`.
- Supabase client usando as variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`; sessão nativa em SecureStore e sessão Web em localStorage.
- `expo-notifications` para notificações locais; `expo-calendar` para leitura/gravação dos calendários nativos; `expo-network` para sincronização ao retornar a conexão; `expo-local-authentication` para biometria opcional por aparelho; `expo-screen-orientation` para o contador em paisagem apenas na tela Hoje.
- `date-fns`/`date-fns-tz`, Zustand, React Native Reanimated, SVG e charges Lottie/SVG locais.
- `app/`: rotas de splash/login/termos, abas Hoje/Espelho/Resumo, Agenda, Perfil, Configurações, alertas, Sobre, Administração e Banco de horas.
- `services/`: cliente Auth/Supabase, batidas/cache/fila offline/notificações, calendário nativo e preferências locais da Agenda, comunicados/convites, controle de sessão, ajustes externos do banco e exportação.
- `utils/`: cálculo de jornada, validação, jornadas configuráveis, projeção de risco de horas para reuniões, saldo acumulado e níveis de alerta.
- `components/charges/`: biblioteca local de 18 variações de charges.
- `supabase/migrations/`: schema versionado; `supabase/functions/`: funções de conta com validação no servidor.

## Configuração local

Requisitos: Node.js compatível com Expo SDK 57, pnpm 9 e Expo Go atualizado. Instale dependências:

```bash
pnpm install
cp .env.example .env
```

Preencha o `.env` local com a URL e a chave anon/publishable fornecidas para o projeto Supabase existente. O arquivo `.env` é ignorado pelo Git; não cole valores em código, issue, print ou commit. A chave `service_role` nunca é necessária no app e não deve existir no `.env` do app; ela é exclusiva do servidor Edge Function.

Inicie o app para Expo Go:

```bash
pnpm start
```

O terminal mostra um QR Code. No Android, abra o Expo Go e leia o QR Code; no iPhone, use a câmera/Expo Go conforme a versão instalada. Para o Preview Web gerenciado pelo projeto, use `pnpm dev`, que inicia Metro Web em `8081` e o servidor do starter em `3000`. O aplicativo de ponto usa o Supabase diretamente e não depende do servidor tRPC do starter.

Comandos úteis:

```bash
pnpm check                 # TypeScript
pnpm lint                  # Expo ESLint
pnpm test                  # Vitest
pnpm test:watch             # Vitest em watch mode
pnpm android               # Expo Go/dev run para Android configurado no ambiente
pnpm ios                   # Expo Go/dev run para iOS configurado no ambiente
```

## Supabase e segurança

O Supabase já existente contém as tabelas `public.profiles`, `public.time_entries`, `public.balance_adjustments`, `public.day_statuses` e as adições `public.user_presence`, `public.user_session_controls`, `public.app_broadcast_messages`, `public.app_broadcast_receipts` e `public.lunch_invites`. Todas as novas tabelas têm RLS; presença e controles de sessão só podem ser lidos pelo próprio usuário, convites são privados aos participantes e comunicados ativos são visíveis a contas ativas. As migrações aplicadas estão versionadas em `supabase/migrations/`.

No projeto existente, o cadastro público (“Allow new users to sign up”) foi desligado no Supabase Auth. O login continua ativo; o app usa a API Supabase com a chave anon e as políticas RLS negam acesso às tabelas a visitantes anônimos. Cada pessoa autenticada acessa somente seus registros. Um administrador pode gerenciar perfis, mas não consulta batidas de outras pessoas. Mudanças na configuração do Auth feitas pelo Dashboard não são controladas por SQL migration; confira a opção após importar/recriar um projeto.

Para reaplicar migrações em outra cópia Supabase, após autenticar a CLI:

**A migração `20261107150000_balance_adjustments.sql` foi aplicada, com autorização explícita, ao projeto existente `duqytmwhlrjqduzscgpa` como migration remota `20261107152710`. A tabela `balance_adjustments` usa RLS e permite ao usuário ativo consultar e inserir apenas os próprios lançamentos.**

**A migração `20261107193404_day_statuses.sql` foi aplicada ao mesmo projeto como migration remota `20261107193404`. A tabela `day_statuses` guarda somente o status pessoal do dia, não exige diagnóstico/documento médico e tem RLS ativa: cada usuário autenticado ativo só pode consultar, inserir ou atualizar o próprio status. Não há política de leitura administrativa.**

**A migração `20261107193956_harden_security_definer_permissions.sql` restringiu ao próprio backend as funções `SECURITY DEFINER` usadas por triggers, retirou a execução de funções internas das roles `anon` e `PUBLIC`, e manteve `is_active_user()`/`is_admin()` disponíveis a usuários autenticados por serem usadas nas políticas RLS.**

**A migração `20261108201303_admin_communications.sql` foi aplicada ao mesmo projeto como migration remota `20261108201303`. Criou tabelas de presença, sinal de logout, comunicados/recibos e convites de almoço, com políticas RLS e RPCs limitadas; não alterou nem apagou batidas, status de dia ou dados de perfil existentes.**

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref duqytmwhlrjqduzscgpa
pnpm dlx supabase db push
```

As batidas armazenam `registrado_em` em UTC e usam `data` civil no fuso `America/Bahia`. A validação é executada também no banco; apenas a validação no cliente não é considerada uma barreira suficiente.

### Edge Functions

As funções ficam em `supabase/functions/` e validam JWT e papel do solicitante antes de usar `SUPABASE_SERVICE_ROLE_KEY` no servidor. São: `admin-create-user`, `admin-reset-password`, `admin-set-user-status`, `admin-session-control` e `delete-account`. `admin-session-control` exige JWT, verifica `role=admin` e `ativo=true`, consulta presença e grava uma solicitação de saída sem expor tokens. A presença indica um heartbeat recente do app, não inventaria tokens/dispositivos. Para implantar manualmente:

```bash
pnpm dlx supabase functions deploy admin-create-user --project-ref duqytmwhlrjqduzscgpa
pnpm dlx supabase functions deploy admin-reset-password --project-ref duqytmwhlrjqduzscgpa
pnpm dlx supabase functions deploy admin-set-user-status --project-ref duqytmwhlrjqduzscgpa
pnpm dlx supabase functions deploy admin-session-control --project-ref duqytmwhlrjqduzscgpa
pnpm dlx supabase functions deploy delete-account --project-ref duqytmwhlrjqduzscgpa
```

As Edge Functions precisam manter disponíveis as variáveis Supabase de servidor (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`); nunca copie a `service_role` para o app. O cadastro pela tela Administração cria conta pelo Auth Admin API, confirma o e-mail e grava `senha_provisoria=true`; o usuário deve escolher senha própria no primeiro acesso. A exclusão de conta apaga o usuário Auth, e as relações `ON DELETE CASCADE` removem o perfil e as batidas.

### Primeiro administrador

Por segurança, não há cadastro aberto e não existe senha de administrador fixa no repositório. Faça bootstrap uma única vez pelo painel Supabase:

1. Em **Authentication → Users**, crie manualmente o usuário administrador usando o e-mail e uma senha escolhidos por você; confirme o e-mail.
2. No **SQL Editor**, atribua o papel admin ao e-mail exato:

```sql
update public.profiles
set role = 'admin', ativo = true
where lower(email) = lower('seu-email@exemplo.com')
returning id, email, role;
```

3. Confira que a consulta retorna exatamente uma linha e entre no app com esse usuário. Depois, a Administração cria as demais contas sem habilitar signup público. Nunca compartilhe uma senha provisória por canal público.

O trigger cria automaticamente o perfil vinculado ao mesmo `auth.users.id`; a consulta SQL acima deve alterar apenas papel/ativação do administrador. Não é necessário gravar manualmente aceite de termos ou sessão no banco: o usuário aceita os termos dentro do app após autenticar.

### Diagnóstico de sessão

O aceite de termos, as batidas (inclusive horário manual) e a troca de senha exigem uma sessão válida do Supabase Auth. Se uma versão antiga da APK exibir “Auth session missing” ou “Sessão não encontrada”, atualize para a APK corrigida; a tela agora confirma a sessão de login antes de avançar e orienta a entrar novamente se ela expirou. Confira também se o e-mail está confirmado, se o perfil correspondente tem `ativo = true` e se o app está usando as variáveis Supabase do ambiente `preview`.

## Uso

A tela **Hoje** apresenta contador ao vivo, tempo faltante, horário-limite projetado, sequência Entrada → Saída para almoço → Volta do almoço → Saída, registro manual HH:mm e fila offline. O fuso padrão é `America/Bahia`; o almoço pausa a contagem. O limite padrão é 10:00, ajustável pelo usuário para um valor menor; o banco nunca aceita mais de 10:00. A jornada sugerida é um único perfil ativo: 08:00–18:00 de segunda a quinta e 08:00–17:00 na sexta, sempre com uma hora de almoço; **Configurações** permite editar ou adicionar jornadas. Os alertas de fim usam a jornada civil correspondente ao dia. Em sábado/domingo sem batidas, o app pergunta se a pessoa vai trabalhar ou descansar; folga, falta/ausência e atestado pausam o contador e não são convertidos em horas negativas. A seção de comunicações em Hoje mostra avisos administrativos com o mascote e convites internos para almoço, com respostas de aceite, indisponibilidade ou reunião; não lê contatos.

Se a confirmação do alerta crítico chegar depois do limite, o app pede confirmação explícita e grava a saída no último horário permitido, com justificativa visível no Espelho; não grava uma jornada acima do teto. Esse registro é um controle pessoal e não substitui o registro oficial do empregador.

Se ainda não houve saída para almoço, o app mostra e agenda um aviso preventivo após 240 minutos por padrão, personalizável de 60 a 480 minutos e com toggle próprio; após registrar a saída para almoço, agenda o retorno segundo os minutos definidos em **Configurações**. A antecedência do retorno também pode ser desativada separadamente. Os marcos de jornada (8:00, 9:00, 9:30, 9:45, 9:50 e 9:55) e o aviso de fim da jornada são configuráveis individualmente; o alerta/bloqueio no limite pessoal, com teto absoluto de 10 horas, nunca pode ser desligado. As notificações são locais; Android pode exigir permissão de notificação e permissão de alarmes exatos nas configurações do sistema. A entrega exata em segundo plano depende das permissões e políticas de bateria do aparelho. O modo Expo Go serve para desenvolvimento; teste notificações/alarme exato no APK final.

**Espelho** permite alternar entre visualização semanal e mensal, navegar por períodos, editar/excluir batidas com confirmação no modo mensal, lançar batidas esquecidas com justificativa, conferir horas extras estimadas e exportar/compartilhar PDF ou CSV do mês. A semana é civil de sete dias e pode cruzar a virada de mês. O **Perfil** concentra identidade e segurança da conta, alteração de senha, exclusão, exportação JSON, termos/privacidade e Administração para quem tem permissão. **Configurações** concentra limite pessoal, jornadas semanais (incluindo a exceção de sexta dentro da jornada ativa), intervalo/aviso de almoço, toggles de alertas, som, vibração, rotação do contador, biometria e tema. A tela **Banco de horas** soma as horas extras estimadas pelo app em todo o histórico com créditos/débitos externos acompanhados de motivo; esses lançamentos são auditáveis e protegidos por RLS. A missão semanal opcional mostra progresso por registros organizados ou situação indicada, não por presença ou horas trabalhadas. Quando há diferença semanal estimada abaixo da escala, orienta a conferir o espelho e combinar com o RH; não recomenda horas extras.

Na jornada selecionada, o aviso de retorno do almoço é programado conforme a antecedência configurada antes da saída registrada + duração do intervalo. Um aviso adicional pode ser programado para o horário final fixo da jornada. A tela Hoje pode exibir apenas o contador em paisagem se a opção de rotação estiver habilitada; as outras abas permanecem em retrato. O cartão HOJE | ESPELHO | RESUMO | AGENDA permanece nessa ordem e posição relativa ao cabeçalho nas telas principais e no Banco de horas; o avatar abre Perfil, Configurações e Sair do Sistema. Um campo editável de link HTTPS e o compartilhamento nativo permitem enviar a página de instalação; a mensagem pede que o novo usuário solicite acesso ao administrador. O aviso “Estou indo almoçar” continua usando o compartilhamento do sistema; convites de almoço entre colegas são internos ao app.

### Ajustar limite, almoço e tempos dos alertas

Em **Configurações**, cada usuário escolhe limite pessoal de 8h, 9h ou 10h e duração do intervalo de almoço (30, 45, 60 ou 90 minutos). O lembrete de pausa padrão aos 240 minutos é personalizável de 60 a 480 e pode ser desligado; o aviso calculado de retorno também tem toggle e mantém a antecedência atual. Cada marco de jornada (8h, 9h, 9h30, 9h45, 9h50, 9h55) e o lembrete do fim programado têm controles próprios em `utils/alerts.ts`/`services/notification-service.ts`; o limite pessoal permanece obrigatório e o teto no banco continua sendo 600 minutos mesmo se alguém alterar apenas a interface.

## Gerar APK para instalação direta (EAS)

O perfil `preview` em `eas.json` gera APK Android de distribuição interna, sem Play Store:

```bash
pnpm dlx eas-cli login
pnpm dlx eas-cli build -p android --profile preview
```

O projeto EAS existente e autorizado está em `https://expo.dev/accounts/edingtonmaquine/projects/olhonoponto`; `app.config.ts` associa este código a `owner: edingtonmaquine` e ao `projectId` `97f93ccd-6d20-4ebd-9b52-f9bb7e4ab41a`. O repositório conectado é somente `olhaoponto/olhaoponto`; o acesso do Expo GitHub App foi limitado a esse repositório. Não crie outro projeto Expo nem vincule este código aos projetos `vivacondo` ou `herois-plus-app`.

O ambiente `preview` do projeto EAS existente já tem `EXPO_PUBLIC_SUPABASE_URL` apontando para `https://duqytmwhlrjqduzscgpa.supabase.co` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` configurada. Se precisar renovar essas variáveis, faça isso no mesmo projeto e ambiente; nunca cadastre `service_role` como variável `EXPO_PUBLIC_*`. O `.env` local é ignorado e não é enviado ao Git.

O build pode ser iniciado pela aba **Builds** do projeto EAS conectado ao GitHub ou pela EAS CLI autenticada. A configuração `extra.eas.projectId` já aponta ao projeto EAS existente e autorizado; não execute `eas project:init` nem selecione outro projeto.

O identificador Android configurado é `space.manus.olhaponto.t099013940753689`. Ao concluir, abra o link do build no Android para baixar e instalar o APK. Se necessário, permita instalação desta origem em **Configurações → Segurança/Apps**. No Android 13+, conceda notificações e configure **Alarmes e lembretes** se o sistema solicitar.

O perfil `preview` incrementa o versionCode remoto automaticamente para que uma APK de correção possa atualizar a instalação anterior, desde que permaneça assinada com a keystore cadastrada no projeto EAS `olhonoponto`.

APK interna anterior a esta rodada: EAS build `2d191fc4-0423-4e06-978f-beb0fa90513b`, versão `1.0.1 (8)`, status `Succeeded`, branch `work/improvements-nov-2026`, commit de código `94d979c`. Para identificar/instalar a build mais recente, consulte a [lista oficial de builds Expo](https://expo.dev/accounts/edingtonmaquine/projects/olhonoponto/builds); um build individual abre a instalação/transferência no Android. As compilações são internas; nenhuma loja foi submetida.

Uma distribuição iOS instalável fora do Expo Go exige Apple Developer/assinatura e configuração Apple; não está configurada neste perfil APK.

## Privacidade

O app coleta nome, e-mail, preferências, batidas inseridas e a situação do dia (trabalho, folga, ausência ou atestado). O status do dia é pessoal, não pede diagnóstico e as policies RLS limitam a leitura/edição ao próprio usuário ativo; administradores não recebem esse conteúdo. A administração não recebe dados de batidas. O app envia um heartbeat de presença enquanto uma sessão autenticada está ativa; a administração vê somente o último sinal e marca “ativo recentemente” até 2 minutos — isso não confirma quantos dispositivos/tokens existem. O pedido administrativo de logout grava um marcador e faz a versão atual do app assinar localmente quando ela o consulta, em até 30 segundos se estiver on-line; isso não revoga no Auth do Supabase JWTs já emitidos nem força versões antigas a encerrar. Convites de almoço ficam visíveis somente ao remetente/destinatário; comunicados são mensagens administrativas e cada recibo de leitura é privado. Termos/Política de Privacidade informam as finalidades e direitos; aceite é gravado com versão e data. O usuário pode exportar seus dados, editar horários e apagar sua conta. Cache e fila offline são separados por usuário; se houver batidas pendentes, o app exige conexão e sincronização antes de concluir o logout, para não perder registros. Notificações de jornada e de reuniões são locais ao dispositivo. Com permissão, a Agenda lê os calendários que a pessoa seleciona e grava reuniões no calendário gravável escolhido; os eventos permanecem no provider/conta de calendário do aparelho e não são enviados ao Supabase pelo app. A escolha de calendários e metadados de lembretes ficam no armazenamento local separado por usuário. O app não lê contatos e o compartilhamento externo só acontece depois da escolha e confirmação do usuário. Não grave segredos ou dados pessoais em logs.

## Observações

- Para habilitar o app com uma nova conta, um admin ativo deve criá-la. O perfil recém-criado deve trocar a senha provisória no primeiro acesso e aceitar os termos.
- Mudanças de senha via Auth devem preservar o metadata `senha_provisoria=false` para manter sincronização com `profiles`.
- As estimativas de horas extras acima de 8h/dia e o texto do Art. 59 são informativos, não aconselhamento jurídico.
