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


## 10. Melhorias solicitadas — implementação autorizada

O usuário autorizou as migrations, o envio da branch de trabalho ao repositório existente e uma APK de teste. A migration `balance_adjustments` e o commit remoto `ad07b32` já estavam no projeto autorizado quando esta rodada começou. Uma build preview anterior havia sido iniciada no Expo; o acompanhamento foi interrompido a pedido do usuário e seu resultado ainda precisa ser verificado.

- [x] **Corrigir edição de batida no Espelho.** Ao abrir o lápis, o usuário pode editar o horário da batida; ao tocar em “Salvar edição”, o sistema deve persistir a alteração e refletir o horário atualizado no Espelho, mantendo justificativa obrigatória e validações de ordem, data, horário futuro e limite diário. A ação de salvar não pode ficar inacessível atrás do teclado.
- [x] **Manter campos visíveis com o teclado aberto.** Ao digitar senha no login ou qualquer outro campo editável, o teclado não pode cobrir o campo em edição nem os controles necessários para concluir a ação; as telas e modais com formulários devem poder rolar/ajustar-se ao teclado em Android e iPhone.
- [x] **Bloquear acesso sem autenticação.** Voltar na tela de login, navegação do sistema ou deep link não pode abrir Hoje, Espelho, Resumo, Perfil, Administração ou qualquer outra rota protegida sem sessão Supabase válida. Sem sessão, encaminhar ao login; tratar a sessão ainda inicializando sem exibir conteúdo protegido.
- [x] **Banco de horas total com saldo externo.** Criar uma opção acessível para visualizar saldo acumulado: saldo estimado pelo app (horas acima de 8h/dia em todo o histórico) somado a ajustes externos informados pelo usuário. Permitir registrar crédito/débito em horas e minutos com motivo, mostrar o histórico dos ajustes e calcular o saldo total sem sobrescrever o cálculo do app. Aplicar acesso somente aos dados do próprio usuário; migration `balance_adjustments` aplicada com RLS ao projeto autorizado.
- [x] **Configuração de jornadas no Perfil.** Permitir criar/selecionar uma ou mais jornadas com nome, horário de início/fim, duração do almoço e dias da semana. A jornada padrão inicial é uma única jornada ativa de segunda a sexta: 08:00–18:00, com 60 minutos de almoço, de segunda a quinta; na sexta, a mesma jornada usa 08:00–17:00 e também 60 minutos. Preservar o limite pessoal e o teto rígido de 10 horas trabalhadas; a duração do intervalo não conta como tempo trabalhado.
- [x] **Aviso antes do retorno do almoço e ao completar a jornada.** Para uma saída ao almoço às 12:00 e 60 minutos configurados, avisar cinco minutos antes das 13:00; se a saída for 12:01 ou 12:10, calcular cinco minutos antes de 13:01 ou 13:10, respectivamente. O alerta de jornada completa usa o horário final fixo da jornada escolhida (por exemplo, 18:00 para a jornada 08:00–18:00) e deve existir além do alerta de limite de horas trabalhadas.
- [x] **Contador em paisagem somente em Hoje.** Quando o usuário girar o aparelho na rota Hoje, apresentar uma visualização ampla dedicada ao cartão “Seu Contador Hoje”, com o tempo/jornada em andamento, pausa ou encerramento; esconder os demais conteúdos e a barra de abas nessa visualização. Manter as demais telas em retrato.

### Publicação da branch e build de teste

- [x] Adicionar e documentar a migração local necessária para ajustes externos do banco de horas, com RLS; aplicar ao Supabase autorizado somente após consentimento explícito.
- [x] Atualizar README e testes relevantes das regras de jornadas, notificações, banco de horas e sessão.
- [x] Enviar o commit `f3fc571` da branch `work/improvements-nov-2026` ao repositório GitHub existente e confirmar o ref remoto; não mesclar à `main` sem autorização separada.
- [x] Iniciar uma build interna APK Android pelo projeto Expo/EAS existente e perfil `preview`, sem criar projeto Expo novo. O acompanhamento foi interrompido a pedido do usuário; retomar/consultar o status somente com novo pedido.


## 11. Ajustes solicitados no anexo — implementação local na branch existente

- [x] **Jornada padrão por dia da semana:** reconfigurar o padrão para 08:00–18:00, 1h de almoço, segunda a quinta; sexta-feira 08:00–17:00, 1h de almoço. Contador e alertas escolhem a jornada correta por data; jornadas personalizadas são preservadas.
- [x] **Saldo pessoal recuperável:** encerrar carregamento em sucesso, sessão ausente, falha de rede ou timeout, apresentar erro recuperável/tentativa novamente, expor “Adicionar saldo existente” e manter retorno a Resumo sempre visível. Sem alterações ao schema ou dados remotos.
- [x] **Teclado e senha no login:** ajustar/rolar a tela no Android/iPhone e usar um controle de olho/olho riscado acessível para mostrar/ocultar senha.
- [x] **Preferência de rotação:** adicionar em Perfil o controle para habilitar/desabilitar a rotação do contador Hoje. Desabilitado, manter retrato; perfis sem a preferência continuam habilitados por compatibilidade.
- [x] **Atalho do avatar:** o avatar ao lado da saudação oferece Perfil/configurações e Sair, mantendo a sincronização das batidas pendentes antes do logout.
- [x] **Navegação sem barra inferior:** mover HOJE | ESPELHO | RESUMO | PERFIL para um cartão abaixo da saudação/data em Hoje e incluir retorno claro nas telas Espelho, Resumo, Perfil e Banco de horas.

**Limite da implementação anterior:** a seleção por lista de colegas não foi implementada. Nesta etapa haverá compartilhamento nativo, no qual o próprio usuário escolhe contato/canal e confirma; o app não acessa contatos nem envia automaticamente.


## 12. Correção prioritária e novas funções solicitadas em 07/11/2026

- [x] **Prioridade 1 — rotas e menu:** corrigir “Voltar para Hoje”, atualmente levando a `olhaponto:///`/“Unmatched Route”, usando a rota index correta do Expo Router (`/(tabs)`). Manter o cartão HOJE | ESPELHO | RESUMO | PERFIL em todas as telas principais (Hoje, Espelho, Resumo, Perfil e Banco de horas), e retirar os botões separados de voltar que possam gerar esse erro. O menu também aparece em Sobre e Administração; telas especiais de login/troca/aceite de termos preservam seus fluxos próprios.
- [x] **Rótulos de batida:** onde aparece “BATER PONTO - ENTRADA”, remover somente “PONTO” e usar “BATER - ENTRADA”; aplicar a mesma forma para saída, saída para almoço e volta do almoço. Não alterar ordem, validação nem persistência das batidas.
- [x] **Jornada ativa de sexta-feira:** manter um só registro da jornada padrão ativa de segunda a sexta; aplicar 08:00–18:00 e 60 min de almoço de segunda a quinta, e exceção interna 08:00–17:00/60 min de almoço na sexta. Mostrar os horários de ambos os blocos dentro da jornada ativa, consolidar os dois registros padrão gerados anteriormente e preservar jornadas personalizadas/alternativas. A consolidação também funciona se a jornada separada de sexta vier antes na lista antiga.
- [x] **Compartilhar aviso do almoço:** incluir uma opção visível em Hoje para compartilhar “Estou indo almoçar agora, se você precisar de algo me avise.” e o horário previsto (“Vou almoçar às HH:mm e volto às HH:mm.”), usando horários reais se a saída para almoço já foi registrada. Abrir o seletor nativo de compartilhamento para o usuário escolher contato/canal e confirmar; não acessar lista de contatos nem enviar automaticamente.
- [x] **Metas e desafios acolhedores:** acrescentar missões semanais opcionais, visualmente envolventes, para completar/revisar registros e indicar corretamente o dia como trabalho, folga, ausência ou atestado; mostrar progresso e feedback positivo sem ranking ou sequência punitiva. Não premiar presença perfeita, horas trabalhadas ou extras. Se o ritmo estiver abaixo da escala, orientar a conferir regras com RH e acompanhar passos seguros, sem prescrever excesso, tirar pausas ou ultrapassar 10 horas/dia. Folga, atestado e ausência não geram punição.
- [x] **Trabalho no fim de semana/descanso:** em sábado ou domingo não previsto na jornada e ainda sem registros, perguntar “Você vai trabalhar hoje?”; ao escolher trabalho, liberar o contador usando a jornada ativa; ao escolher descanso, mostrar uma ilustração atraente de relógio/pessoa descansando e estado claro de folga, sem o relógio parecer pendente de uma batida.
- [x] **Ausência ou atestado no dia:** permitir marcar o dia corrente como “Ausência” ou “Atestado”, sem pedir diagnóstico/documento médico. O status deve ficar privado ao próprio usuário, ser editável, sobreviver entre sessões/dispositivos e ser excluído de desafios e saldos de regularização. Migration aplicada e RLS/policies próprias verificadas no Supabase autorizado.
- [x] **Pesquisa de mercado:** comparar Pontotel, Tangerino/Sólides, Oitchau, Ahgora e Jibble em fontes oficiais verificadas; documentar que os padrões encontrados são marcação simples, transparência de registros/saldos, alertas operacionais e solicitações/justificativas digitais. As fontes abertas não documentaram gamificação de ponto; aplicar missões próprias apenas para autocuidado e clareza, sem copiar marcas nem alegar recursos sem fonte.
- [x] **Supabase e privacidade:** aplicar a migration aditiva de status diário no projeto existente, verificar RLS e políticas somente do próprio usuário, e restringir execução pública/anônima das funções internas `SECURITY DEFINER`. Os helpers de política continuam disponíveis a usuários autenticados; não houve alteração de dados pessoais.
- [x] **Branch e APK:** enviar somente a branch `work/improvements-nov-2026` ao repositório existente (commit de código `4244e43`) e gerar a APK Android interna `preview` no projeto Expo existente. Build `ea98ab5c-48a7-479e-9b36-78c62690b379`, versão `1.0.1 (5)`, status `Succeeded`; sem submissão a lojas e sem alterações em `main`.

**Validação desta rodada:** `pnpm check`, `pnpm lint`, `pnpm test` (71 testes aprovados, 1 legado ignorado), `git diff --check` e exportação de bundle Android Expo passaram; o build EAS `ea98ab5c` também concluiu com sucesso e disponibilizou uma APK interna.

**Princípio de produto:** a gamificação celebra consistência e descanso; não pressiona a trabalhar doente, faltar à pausa ou fazer hora extra. O aviso ao colega permanece sob controle do usuário; sem integração que leia contatos ou envie mensagens em segundo plano.


## 13. Ajustes de almoço e Agenda solicitados em 07/11/2026

- [x] **Retorno calculado pela batida real:** remover a ideia de horário fixo para sair ao almoço (inclusive o campo “Horário previsto para sair ao almoço (HH:mm)” e textos que mostrem 12:00). Quando a pessoa registrar `saida_almoco`, calcular o retorno pela hora registrada mais a duração de almoço da jornada ativa. Exemplo obrigatório: batida às 13:26, duração de 60 min → retorno às 14:26; com antecedência de 5 min, avisar às 14:21. A mesma lógica deve valer para qualquer hora de saída e também após editar a batida.
- [x] **Antecedência personalizada do aviso:** manter as opções 5, 10 e 15 min e adicionar entrada personalizada para minutos inteiros positivos, aceitando, por exemplo, 2 min. Persistir a preferência e usá-la no lembrete calculado a partir da batida real.
- [x] **Perfil e Agenda no avatar:** retirar Perfil da barra de navegação das telas principais; o avatar superior direito deve oferecer as rotas “Perfil” e “Agenda”, além de “Sair”. A rota Perfil mantém todas as configurações e funcionalidades existentes.
- [x] **Agenda de reuniões com lembretes:** permitir criar, listar, editar e excluir reuniões com título, data e hora; programar lembrete local do aplicativo para cada reunião e reagendar/cancelar o lembrete ao editar/excluir. Recalcular notificações sem apagar lembretes de reunião ao atualizar alertas de jornada. Por privacidade, os eventos ficam no armazenamento local do aparelho por usuário, sem sincronizar títulos/detalhes com o Supabase; deixar claro na Agenda que não há sincronização e que eventos/lembretes locais são removidos ao sair da conta.
- [x] **Validação desta etapa:** adicionar teste de regressão para a conta 13:26 + 60 min = 14:26 e antecedência de 5 min = 14:21, validar opção personalizada de 2 min, executar checks/lint/testes e confirmar que os lembretes da Agenda não são cancelados quando uma batida ou preferência da jornada muda. TypeScript, lint e export Android Expo passaram; 81 testes passaram e 1 teste legado está ignorado; `git diff --check` não apontou problemas.

- [ ] **Publicação e APK desta etapa:** registrar a implementação na branch existente `work/improvements-nov-2026`, enviar ao repositório existente e criar APK Android interna `preview` no projeto Expo existente; não publicar em loja nem tocar em `main`.
- **Configuração prevista:** Android + perfil `preview`, sem auto-submit. Registrar o ID EAS e status final depois de concluir a build.


- [ ] **Publicação e APK desta etapa:** registrar a implementação na branch existente `work/improvements-nov-2026`, enviar ao repositório existente e criar APK Android interna `preview` no projeto Expo existente; não publicar em loja nem tocar em `main`.
- **Configuração prevista:** Android + perfil `preview`, sem auto-submit. Registrar o ID EAS e status final depois de concluir a build.
