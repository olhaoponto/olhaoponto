# Olha o Ponto

Aplicativo mobile Expo/React Native + TypeScript para acompanhar os próprios horários registrados no ponto da empresa, pausar o contador durante o almoço e receber alertas locais antes do limite diário de trabalho. O app é um controle pessoal; não substitui o relógio, sistema ou registro oficial de ponto do empregador. Idealizado e criado por Marcos Henrique Edington Santos.

## Tecnologia e estrutura

- Expo SDK 57 / React Native / Expo Router / TypeScript.
- Supabase Auth, Postgres, RLS e Edge Functions; projeto existente `duqytmwhlrjqduzscgpa`.
- Supabase client usando as variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`; sessão nativa em SecureStore e sessão Web em localStorage.
- `expo-notifications` para notificações locais; `expo-network` para sincronização ao retornar a conexão; `expo-local-authentication` para biometria opcional por aparelho; `expo-screen-orientation` para o contador em paisagem apenas na tela Hoje.
- `date-fns`/`date-fns-tz`, Zustand, React Native Reanimated, SVG e charges Lottie/SVG locais.
- `app/`: rotas de splash/login/termos, abas Hoje/Espelho/Resumo/Perfil, alertas, Sobre, Administração e Banco de horas.
- `services/`: cliente Auth/Supabase, batidas/cache/fila offline/notificações, ajustes externos do banco e exportação.
- `utils/`: cálculo de jornada, validação, jornadas configuráveis, saldo acumulado e níveis de alerta.
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

O Supabase já existente contém as tabelas `public.profiles` e `public.time_entries`, RLS, trigger de perfil, índices, constraint de batida única diária e trigger de validação de cronologia, fuso/dia e limite hard de 10h. As migrações aplicadas estão versionadas em `supabase/migrations/`.

No projeto existente, o cadastro público (“Allow new users to sign up”) foi desligado no Supabase Auth. O login continua ativo; o app usa a API Supabase com a chave anon e as políticas RLS negam acesso às tabelas a visitantes anônimos. Cada pessoa autenticada acessa somente seus registros. Um administrador pode gerenciar perfis, mas não consulta batidas de outras pessoas. Mudanças na configuração do Auth feitas pelo Dashboard não são controladas por SQL migration; confira a opção após importar/recriar um projeto.

Para reaplicar migrações em outra cópia Supabase, após autenticar a CLI:

**A migração `20261107150000_balance_adjustments.sql` foi aplicada, com autorização explícita, ao projeto existente `duqytmwhlrjqduzscgpa` como migration remota `20261107152710`. A tabela `balance_adjustments` usa RLS e permite ao usuário ativo consultar e inserir apenas os próprios lançamentos.**

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref duqytmwhlrjqduzscgpa
pnpm dlx supabase db push
```

As batidas armazenam `registrado_em` em UTC e usam `data` civil no fuso `America/Bahia`. A validação é executada também no banco; apenas a validação no cliente não é considerada uma barreira suficiente.

### Edge Functions

As funções ficam em `supabase/functions/` e validam JWT e papel do solicitante antes de usar `SUPABASE_SERVICE_ROLE_KEY` no servidor. São: `admin-create-user`, `admin-reset-password`, `admin-set-user-status` e `delete-account`. Para implantá-las no projeto vinculado:

```bash
pnpm dlx supabase functions deploy admin-create-user --project-ref duqytmwhlrjqduzscgpa
pnpm dlx supabase functions deploy admin-reset-password --project-ref duqytmwhlrjqduzscgpa
pnpm dlx supabase functions deploy admin-set-user-status --project-ref duqytmwhlrjqduzscgpa
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

A tela **Hoje** apresenta contador ao vivo, tempo faltante, horário-limite projetado, sequência Entrada → Saída para almoço → Volta do almoço → Saída, registro manual HH:mm e fila offline. O fuso padrão é `America/Bahia`; o almoço pausa a contagem. O limite padrão é 10:00, ajustável pelo usuário para um valor menor; o banco nunca aceita mais de 10:00. A jornada sugerida é 08:00–18:00 de segunda a quinta e 08:00–17:00 na sexta, sempre com uma hora de almoço; o Perfil permite editar ou adicionar jornadas. Os alertas de fim usam a jornada civil correspondente ao dia.

Se a confirmação do alerta crítico chegar depois do limite, o app pede confirmação explícita e grava a saída no último horário permitido, com justificativa visível no Espelho; não grava uma jornada acima do teto. Esse registro é um controle pessoal e não substitui o registro oficial do empregador.

Se ainda não houve saída para almoço, o app mostra e agenda um aviso preventivo ao completar 4:00 horas trabalhadas; após registrar a saída para almoço, agenda o retorno segundo os minutos definidos no Perfil. Os alertas de jornada permanecem nos marcos 8:00, 9:00, 9:30, 9:45, 9:50, 9:55 e limite pessoal. As notificações são locais; Android pode exigir permissão de notificação e permissão de alarmes exatos nas configurações do sistema. A entrega exata em segundo plano depende das permissões e políticas de bateria do aparelho. O modo Expo Go serve para desenvolvimento; teste notificações/alarme exato no APK final.

**Espelho** permite navegar por mês/ano, editar/excluir batidas com confirmação, lançar uma batida esquecida com justificativa, conferir horas extras estimadas e exportar/compartilhar PDF ou CSV. O **Perfil** exporta o histórico em JSON, permite alterar preferências, configurar jornadas semanais, desabilitar a rotação do contador, consultar opções a partir do avatar na tela Hoje e solicitar a exclusão da conta. A tela **Banco de horas** soma as horas extras estimadas pelo app em todo o histórico com créditos/débitos externos acompanhados de motivo; esses lançamentos são auditáveis e protegidos por RLS. A biblioteca e os cálculos principais são locais/offline.

Na jornada selecionada, o aviso de retorno do almoço é programado cinco minutos antes da saída registrada + duração do intervalo. Um aviso adicional é programado para o horário final fixo da jornada. A tela Hoje pode exibir apenas o contador em paisagem se a opção de rotação estiver habilitada; as outras abas permanecem em retrato. A navegação principal aparece em um cartão no topo da tela Hoje; as telas Espelho, Resumo, Perfil e Banco de horas têm retorno próprio.

### Ajustar limite, almoço e tempos dos alertas

No Perfil, cada usuário escolhe limite pessoal de 8h, 9h ou 10h e previsão de almoço de 30, 45, 60 ou 90 minutos. O lembrete de pausa padrão aos 240 minutos está separado em `LUNCH_REMINDER_MINUTES`; os marcos de jornada (8h, 9h, 9h30, 9h45, 9h50, 9h55 e limite) e a cadência de repetição estão centralizados em `utils/alerts.ts` (`ALERT_THRESHOLDS`). Um desenvolvedor deve manter a agenda em `services/notification-service.ts` e os testes correspondentes atualizados. O banco continua impondo o teto de 600 minutos trabalhados mesmo se alguém alterar apenas a interface.

## Gerar APK para instalação direta (EAS)

O perfil `preview` em `eas.json` gera APK Android de distribuição interna, sem Play Store:

```bash
pnpm dlx eas-cli login
pnpm dlx eas-cli build -p android --profile preview
```

O novo projeto EAS está em `https://expo.dev/accounts/edingtonmaquine/projects/olhonoponto`; `app.config.ts` associa este código a `owner: edingtonmaquine` e ao `projectId` `97f93ccd-6d20-4ebd-9b52-f9bb7e4ab41a`. O repositório conectado é somente `olhaoponto/olhaoponto`; o acesso do Expo GitHub App foi limitado a esse repositório. O projeto não está vinculado aos projetos Expo `vivacondo` ou `herois-plus-app`.

Antes do build, abra **Expo Dashboard → projeto Olha o Ponto → Environment variables** e cadastre no ambiente `preview` `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` com os valores do `.env` local. O arquivo `.env` é ignorado e não é enviado ao Git; por isso, essas variáveis de cliente precisam existir no ambiente remoto da EAS. Use o tipo **Plain text**: ambas são configuração pública do cliente; a anon/publishable key ficará embutida no app. Nunca cadastre `service_role` como variável `EXPO_PUBLIC_*`.

O build pode ser iniciado pela aba **Builds** do projeto EAS conectado ao GitHub ou pela EAS CLI autenticada. A configuração `extra.eas.projectId` já aponta ao projeto novo; não execute `eas project:init` nem selecione outro projeto.

O identificador Android configurado é `space.manus.olhaponto.t099013940753689`. Ao concluir, abra o link do build no Android para baixar e instalar o APK. Se necessário, permita instalação desta origem em **Configurações → Segurança/Apps**. No Android 13+, conceda notificações e configure **Alarmes e lembretes** se o sistema solicitar.

O perfil `preview` incrementa o versionCode remoto automaticamente para que uma APK de correção possa atualizar a instalação anterior, desde que permaneça assinada com a keystore cadastrada no projeto EAS `olhonoponto`.

Uma distribuição iOS instalável fora do Expo Go exige Apple Developer/assinatura e configuração Apple; não está configurada neste perfil APK.

## Privacidade

O app coleta apenas nome, e-mail, preferências e batidas inseridas pelo usuário. A administração não recebe dados de batidas. Termos/Política de Privacidade informam as finalidades e direitos; aceite é gravado com versão e data. O usuário pode exportar seus dados, editar horários e apagar sua conta. Cache e fila offline são separados por usuário; se houver batidas pendentes, o app exige conexão e sincronização antes de concluir o logout, para não perder registros. Notificações de jornada são locais ao dispositivo. Não grave segredos ou dados pessoais em logs.

## Observações

- Para habilitar o app com uma nova conta, um admin ativo deve criá-la. O perfil recém-criado deve trocar a senha provisória no primeiro acesso e aceitar os termos.
- Mudanças de senha via Auth devem preservar o metadata `senha_provisoria=false` para manter sincronização com `profiles`.
- As estimativas de horas extras acima de 8h/dia e o texto do Art. 59 são informativos, não aconselhamento jurídico.
