# TODO — Olha o Ponto

## Estado inicial

- [x] As sete telas conceituais (Login, Home, Espelho, Resumo, Perfil, Administração e alerta final) foram apresentadas e aprovadas pela pessoa usuária.
- [x] Implementar as telas aprovadas no starter Expo, respeitando o plano em `plan.md`; rotas/telas entregues em `app/` e verificadas por exportação Expo Web.

## 1. Inicialização, navegação e autenticação

- [x] Splash/carregamento (antes do login): animar checagem real de conexão com Supabase e sessão salva, com as etapas “Conectando ao banco...”, “Sincronizando batidas...” e “Preparando seu espelho de ponto...”, barra de progresso e mascote; seguir para login ou Home.
- [x] Login: e-mail e senha, “esqueci minha senha”, mensagens amigáveis; no primeiro acesso, apresentar Termo de Uso e Política de Privacidade (LGPD) para aceite.
- [x] Não existe cadastro aberto (auto-cadastro) neste primeiro momento. A opção “Allow new users to sign up” foi desativada e conferida após recarregar o Supabase Auth; login por e-mail permanece habilitado, sem alterar outras opções. Não criar tela de “criar conta” no login.
- [x] Dois papéis: ADMINISTRADOR e USUÁRIO (campo `role` na tabela `profiles`). Login com e-mail e senha usando Supabase Auth; a senha não é MD5. Incluir “esqueci minha senha”.
- [x] Primeiro login de um usuário criado pelo admin: obrigar troca da senha provisória.

## 2. Registro de ponto e limite diário

- [x] Limite máximo: 10:00 horas trabalhadas por dia, padrão 10h e teto server-side; tempo de almoço não conta como trabalhado. O usuário pode configurar limite pessoal menor; lógica do app é centralizada e o banco mantém o teto de segurança de 600 minutos.
- [x] Fórmula: horas trabalhadas = (saída para almoço − entrada) + (saída − volta do almoço).
- [x] Cálculo começa no momento da primeira batida e atualiza ao vivo, segundo a segundo, enquanto o app estiver aberto. Ao reabrir o app, recalcular pelos horários registrados.
- [x] Sempre exibir na Home: “Você já trabalhou HH:MM hoje” e “Faltam HH:MM para o limite de 10:00”.
- [x] Sempre exibir o horário-limite de saída projetado: entrada + 10h + tempo de almoço. Enquanto o almoço não for registrado, projetar com 1h de almoço (configurável); depois, recalcular com o almoço real.
- [x] Sempre 4 batidas por dia: Entrada, Saída para almoço, Volta do almoço, Saída. O botão segue a ordem sozinho e mostra a próxima batida.
- [x] Não permitir registrar (nem pelo botão, nem digitando) uma batida que faça o total passar de 10:00. Explicar o motivo e horário máximo permitido. No alerta crítico, se a confirmação chegar atrasada, mostrar confirmação explícita e registrar no último horário permitido com justificativa visível, em vez de gravar jornada acima do teto.
- [x] Validar ordem cronológica, impedir horário futuro e batida duplicada do mesmo tipo no dia.
- [x] Interface no fuso `America/Bahia`; timestamps em UTC no banco.
- [x] Funcionar offline: guardar batidas localmente e sincronizar depois, inclusive ao voltar a conexão.
- [x] Registrar retroativamente com justificativa de esquecimento, sempre respeitando o limite.

## 3. Alertas e biblioteca de animações

- [x] Todos os tempos dos alertas são configuráveis no módulo central de thresholds/documentados no README.
- [x] Às 8:00 trabalhadas (jornada normal cumprida): notificação amigável + banner amarelo “Jornada normal completa. A partir daqui é hora extra!”.
- [x] Às 9:00 (faltam 60 min): notificação + banner laranja fixo + vibração curta.
- [x] Às 9:30 (faltam 30 min): notificação + modal em tela cheia com contagem regressiva + vibração + som.
- [x] Às 9:45 (faltam 15 min): overlay sobrepondo o app inteiro, fundo laranja/vermelho pulsando, contagem regressiva grande, reaparece a cada 5 minutos.
- [x] Às 9:50 e 9:55 (faltam 10 e 5 min): overlay vermelho, vibração contínua, som de alarme, tela mantida ligada, reaparece a cada minuto até registrar a saída.
- [x] Às 10:00 (limite atingido): overlay vermelho bloqueando tudo: “LIMITE ATINGIDO! Pare de trabalhar e bata o ponto de saída AGORA!”, com botão “Registrar saída agora” e fluxo seguro para concluir a batida.
- [x] Tema da Home muda gradualmente de verde para amarelo, laranja e vermelho conforme o tempo avança; ao concluir a saída, volta ao estado visual verde/teal de jornada encerrada.
- [x] Agendar todas as notificações locais ao registrar uma batida; recalcular a cada nova batida ou edição; cancelar as que perderam sentido ou quando a jornada é encerrada.
- [x] Pausar contador e alertas durante o almoço e avisar quando for hora de voltar.
- [x] Ao tocar em qualquer notificação, abrir a Tela de Animação Engraçada do nível correspondente.
- [x] App aberto: overlays dentro do app. App fechado/segundo plano: notificações do sistema com prioridade máxima (canal Android de importância alta). No Android 13+, pedir permissão de notificação e tratar permissão de alarmes exatos.
- [x] Documentar no README as limitações no Expo Go e a diferença no APK.
- [x] Criar biblioteca com pelo menos 15 animações/charges diferentes, distribuídas pelos níveis de alerta (pelo menos 2 ou 3 por nível) e sorteadas aleatoriamente sem repetir a mesma em seguida. Usar Lottie com JSON embutido sem download externo ou Reanimated/SVG; charges em quadrinhos de 2–3 quadros com balões também são permitidas. Implementadas 18 variações locais em SVG/Reanimated.
- [x] Incluir variedade de temas: profissional de TI digitando loucamente com café e bugs; servidor pegando fogo e estagiário com extintor; relógio gigante perseguindo o usuário; foguete “decolando para casa”; chefe-robô “VAI PRA CASA!”; cadeira com raízes e funcionário preso; café esfriando e “10:00 chegando”; gato digitando e pedindo “Vai embora!”; bateria do funcionário descarregando; ampulheta virando e areia caindo rápido; mascote relógio com placa “Hora de ir!”; semáforo verde/amarelo/vermelho; ônibus esperando o funcionário; pizza e sofá em casa; e charges originais adicionais.
- [x] Cada animação mostra texto curto e bem-humorado, tempo trabalhado, horário-limite e botão “Entendido, já vou!”. Os níveis finais (9:50 em diante) ficam mais frenéticos e com texto mais firme; o limite tem botão crítico de registro da saída.

## 4. Espelho, resumos, perfil e informações

- [x] Home (Hoje): botão grande “BATER PONTO”, campo opcional “Informar horário exato”, as 4 batidas do dia, contador ao vivo, horas restantes, horário-limite, barra de progresso colorida e banner do nível de alerta atual.
- [x] Espelho de ponto: histórico completo das batidas do usuário, organizado por mês, navegação mês a mês e seletor de mês/ano. Mostrar data, dia da semana, Entrada, Saída almoço, Volta almoço, Saída, total trabalhado, horas extras (acima de 8h) e observações/marcação de “editado” ou “informado manualmente”. Destacar visualmente dias que chegaram perto do limite; totais do mês no rodapé.
- [x] Espelho: exportar em PDF e compartilhar; avisar que é controle pessoal e não substitui o espelho oficial do empregador; editar/excluir batida com confirmação, sempre respeitando o limite de 10:00. A edição atualiza só a hora da batida no mesmo dia e requer justificativa.
- [x] Resumo mensal: total de horas, média diária, banco de horas estimado e gráfico simples. Incluir resumo semanal e banco de horas acumulado.
- [x] Perfil: editar nome e e-mail, alterar senha, preferências de alerta (limite, almoço, som, vibração), tema claro/escuro, botão “Exportar meus dados” e, com destaque, “APAGAR MINHA CONTA”.
- [x] Sobre: “Sobre o aplicativo”; “Sobre o artigo”, explicando em linguagem simples a regra das 10 horas diárias (jornada normal de 8h mais até 2h extras, Art. 59 da CLT), com aviso de que é informativo e não substitui orientação jurídica; “Sobre o criador”: “Aplicativo criado por Marcos Edington, com o objetivo de alertar o usuário para não passar do limite de 10:00 horas trabalhadas.”; mostrar também a versão do app.
- [x] Design leve, profissional e acolhedor, com espaço em branco, cantos arredondados, sombras suaves, tipografia moderna (Inter ou Poppins), azul-petróleo/turquesa principal, acentos amarelo e coral e modo escuro. Mascote simpático de relógio, microinterações, feedback tátil, confete ao fechar o dia dentro do limite, mensagens bem-humoradas, estados de carregamento e vazio bem desenhados, bom contraste e labels acessíveis. Responsivo em Android e iOS.

## 5. Administração, privacidade e LGPD

- [x] O administrador, ao logar, vê menu extra “Administração” onde pode cadastrar usuário (nome, e-mail e senha provisória), listar usuários, redefinir senha e ativar/desativar usuário. Dados cadastrais básicos: apenas nome e e-mail.
- [x] O administrador não pode ver as batidas de ponto dos outros usuários; privacidade garantida por RLS, somente gerencia contas.
- [x] Coletar apenas dados básicos: nome e e-mail, mais as batidas que o próprio usuário registra.
- [x] Termo de Uso e Política de Privacidade claros no primeiro acesso, aceite registrado com data/hora e disponíveis depois no Perfil/Sobre.
- [x] Direito de exclusão: botão “Apagar minha conta” com dupla confirmação (digitar a senha ou a palavra APAGAR). Remover usuário do Supabase Auth, profile, todas batidas e preferências (DELETE CASCADE), via Edge Function `delete-account` que valida o usuário logado e apaga somente a própria conta.
- [x] Direito de acesso/portabilidade: “Exportar meus dados” em CSV/JSON.
- [x] RLS garantindo que cada usuário veja apenas seus dados; nada de dados pessoais em logs.
- [x] Descrever no README as decisões de privacidade tomadas.
- [x] Biometria opcional para abrir o app; tela de erro amigável e tratamento global de erros.

## 6. Supabase e schema

- [x] Usar migrações SQL versionadas em `/supabase/migrations`; a migração inicial foi aplicada ao projeto Supabase existente.
- [x] Tabelas criadas: `profiles` (`id = auth.users.id`, nome, email, role [admin|user], ativo, aceite_termos_em, almoco_minutos, limite_minutos [padrão 600], fuso, preferências de alerta); `time_entries` (`id`, `user_id`, `data`, `tipo` [entrada|saida_almoco|volta_almoco|saida], `registrado_em timestamptz`, `horario_informado_manual boolean`, `editado boolean`, `criado_em`).
- [x] RLS ativa: usuário autenticado acessa somente seus dados; admin pode gerenciar/consultar profiles, mas NÃO lê time_entries de terceiros; role anon não recebeu acesso às tabelas.
- [x] Criado trigger para profile, índice por (`user_id`, `data`) e constraint única para impedir batida duplicada do mesmo tipo no dia.
- [x] Edge Functions `admin-create-user`, `admin-reset-password`, `admin-set-user-status` e `delete-account` estão implantadas no projeto existente; exigem JWT e usam service role somente no servidor.
- [x] No app usar somente URL e anon key do projeto existente, lidas das variáveis de ambiente Expo `EXPO_PUBLIC_*`; `.env` local não vai para GitHub nem para o ZIP.
- [x] Desativar somente o cadastro público no Supabase Auth; login e API do aplicativo continuam habilitados com RLS.

## 7. Build, documentação e distribuição

- [x] Usar repositório GitHub existente `olhaoponto`, sem criar outro; enviar o projeto com `.gitignore` correto (`node_modules`, `.env`, `.expo`), commit organizado e README completo. Não commitar segredos. Após confirmação explícita, enviar à branch `main` do repositório público existente sem mudar visibilidade; preservar o arquivo `inicio.txt` que já existia.
- [x] Configurar `app.config.ts` com nome “Olha o Ponto”, package Android, versão, ícone, splash e permissões de notificação; criar `eas.json` com perfil `preview`, `android.buildType = apk` e distribuição interna.
- [x] README em português: pré-requisitos, instalação pnpm, configurar `.env`, aplicar migrações e Edge Functions, criar o primeiro admin, iniciar Expo Go, gerar APK e alterar limite/níveis de alerta.
- [x] README explica: criar conta Expo, instalar eas-cli, `eas login`, `eas build -p android --profile preview`, baixar o APK e instalar no celular habilitando instalação de fontes desconhecidas/modo desenvolvedor; distribuição iPhone exige conta de desenvolvedor Apple e fica para depois.
- [x] Pastas organizadas em `app/` (Expo Router), `components`, `hooks` (helpers do starter), `services`, `store`, `utils`, tema, `assets` e `supabase`, respeitando o starter.
- [x] Entregar ZIP pronto para Visual Studio Code, sem `.env`, `.git`, `node_modules` ou caches, com `.env.example` e scripts `start`, `android`, `ios`, `test` e `lint`.
- [x] Executadas verificações finais: TypeScript, ESLint, exportação Expo Web e Vitest; 44 testes passaram e 1 teste legado de logout permaneceu marcado como skip.
- [x] Se algo ficar ambíguo, escolher opção mais simples e segura, documentar a decisão no README e continuar sem travar a entrega.

## 8. Correções após o teste da primeira APK

- [x] Autenticação e sessão: depois do login por e-mail/senha, manter a sessão Supabase efetivamente retornada; não avançar para Termos, Home ou telas protegidas se ela estiver ausente. Restaurar a sessão de forma segura quando possível e, se expirada, orientar o usuário a entrar novamente sem expor tokens. A aceitação de Termos deve gravar versão e data/hora no perfil do usuário autenticado, sem exigir atualização manual do banco.
- [x] Batidas e senha: “BATER PONTO” com horário atual ou informado manualmente deve funcionar na mesma sessão autenticada e mostrar erro de autenticação claro somente se ela realmente expirou; o horário manual não deve alterar a necessidade de autenticação. A troca de senha deve atualizar a senha Auth do usuário autenticado e apresentar erro/reautenticação recuperáveis, sem depender de alteração manual no Supabase.
- [x] Espelho e Resumo: encerrar o indicador de carregamento quando a sessão ainda estiver inicializando, estiver ausente, a consulta falhar/rejeitar ou o usuário trocar de mês; exibir estado de erro e botão de nova tentativa, indicar quando forem dados locais/offline e separar um erro de sincronização de um mês sem registros. Uma resposta antiga não pode sobrescrever o mês selecionado mais recentemente.
- [x] Avisos de jornada: programar notificações locais reais quando a sessão estiver ativa; acrescentar um aviso de pausa ao atingir 4:00 horas trabalhadas se a saída para almoço ainda não tiver sido registrada; manter o lembrete de retorno após os minutos configurados no Perfil e os níveis atuais de 8:00 a 10:00. Recalcular/cancelar notificações após cada batida/edição, alteração de preferências, fim da jornada e logout.
- [x] Sobre e tom dos alertas: dizer explicitamente que o app serve apenas para acompanhar os próprios horários do ponto da empresa e não substitui o registro original/oficial; identificar o criador pelo nome completo Marcos Henrique Edington Santos. Tornar movimento e textos dos avisos mais sóbrios, preservando legibilidade, níveis, repetição e a ação crítica de registrar a saída.

## 9. Entrega da APK corrigida

- [x] A APK Android inicial foi gerada no projeto Expo EAS `olhonoponto` e a pessoa usuária confirmou que a baixou; o repositório público autorizado é `olhaoponto/olhaoponto`, sem incluir segredos.
- [ ] Nova APK corrigida: sincronizar somente o código/arte autorizado em `olhaoponto/olhaoponto`, preservar o arquivo preexistente `inicio.txt` e os projetos Expo `vivacondo` e `herois`; gerar a APK pelo perfil `preview` no ambiente `preview`, com `android.buildType=apk` e versionCode incrementado para atualização sobre a versão instalada. Entregar o link/arquivo do build corrigido e um ZIP-fonte sem `.env`, chaves, `.git`, `node_modules` ou caches.
