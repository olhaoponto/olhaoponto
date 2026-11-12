import type { PunchType } from '@/types/app';

export const PECAS_POR_DIA = 4;
export const DIAS_POR_SEMANA = 5;
export const PECAS_POR_QUEBRA_CABECA = PECAS_POR_DIA * DIAS_POR_SEMANA;
export const PUZZLE_COLUMNS = 4;
export const PUZZLE_ROWS = 5;

export type JourneyPieceOrigin = 'entrada' | 'saida_almoco' | 'volta_almoco' | 'saida_final' | 'bonus';
export const PUNCH_ORIGINS: Record<Exclude<PunchType, never>, JourneyPieceOrigin> = {
  entrada: 'entrada',
  saida_almoco: 'saida_almoco',
  volta_almoco: 'volta_almoco',
  saida: 'saida_final',
};

export const PUNCH_LABELS: Record<JourneyPieceOrigin, string> = {
  entrada: 'Entrada',
  saida_almoco: 'Saída do almoço',
  volta_almoco: 'Retorno do almoço',
  saida_final: 'Saída definitiva',
  bonus: 'Missão bônus',
};

export const JOURNEY_IMAGES = [
  { id: 'rest-day-clock', title: 'Pausa merecida' },
  { id: 'clock-carnival', title: 'Ritmo leve' },
  { id: 'clock-junina', title: 'Arraiá do ponto' },
  { id: 'clock-christmas', title: 'Tempo de celebrar' },
  { id: 'clock-newyear', title: 'Novo ciclo' },
] as const;

export const MASCOT_POSES = [
  'clock-base', 'clock-carnival', 'clock-junina', 'clock-christmas', 'clock-newyear',
  'clock-base', 'clock-carnival', 'clock-junina', 'clock-christmas', 'clock-newyear',
  'clock-base', 'clock-carnival',
] as const;

export const MASCOT_MESSAGES = [
  ['respirar-01', 'Um respiro muda o ritmo. Inspire, solte o ar e siga no seu tempo.', 'bem-estar', 0],
  ['agua-01', 'Seu relógio lembrou: um gole de água também conta como boa prática.', 'bem-estar', 1],
  ['alongar-01', 'Alongue os ombros por alguns segundos. Pequenas pausas deixam o dia mais leve.', 'bem-estar', 2],
  ['foco-01', 'Uma coisa de cada vez. O caminho fica mais claro quando você olha para o próximo passo.', 'motivação', 3],
  ['calma-01', 'Hoje não precisa ser perfeito; precisa ser possível e gentil com você.', 'motivação', 4],
  ['curiosidade-01', 'Curiosidade rápida: o primeiro relógio mecânico portátil surgiu no século XVI.', 'curiosidade', 0],
  ['curiosidade-02', 'O tempo passa igual, mas a forma de vivê-lo pode ser mais tranquila.', 'curiosidade', 1],
  ['humor-01', 'Meu ponteiro tentou tirar folga, mas lembrou que ainda tinha missão.', 'humor', 2],
  ['humor-02', 'Se o café ajudou, agradeça. Se não ajudou, pelo menos foi uma reunião importante.', 'humor', 3],
  ['gratidao-01', 'Uma coisa boa de hoje já merece ser percebida. Qual foi a sua?', 'gratidão', 4],
  ['gratidao-02', 'Obrigado por cuidar do seu tempo e também do ritmo de quem trabalha com você.', 'gratidão', 0],
  ['organizacao-01', 'Escolha a prioridade do momento e deixe o restante respirar por alguns minutos.', 'organização', 1],
  ['organizacao-02', 'Uma lista curta costuma ser mais amiga do que uma lista impossível.', 'organização', 2],
  ['segunda-01', 'Segunda começa melhor quando você escolhe um passo simples para abrir a semana.', 'dias', 3],
  ['terca-01', 'Terça tem ritmo de continuidade: um bom passo hoje já prepara o próximo.', 'dias', 4],
  ['quarta-01', 'Quarta no meio do caminho. Olhe para trás e reconheça o que já avançou.', 'dias', 0],
  ['quinta-01', 'Quinta pede constância, não pressa. Seu caminho está sendo construído.', 'dias', 1],
  ['sexta-01', 'Sexta chegou: feche o dia com clareza e leve para casa apenas o que importa.', 'dias', 2],
  ['ponto-01', 'Cada batida registrada é uma pequena peça no seu quadro de boas práticas.', 'ponto', 3],
  ['ponto-02', 'Entrada registrada, primeiro passo dado. O mascote está torcendo por você.', 'ponto', 4],
  ['ponto-03', 'A pausa também faz parte do caminho. Registre, respire e retorne bem.', 'ponto', 0],
  ['ponto-04', 'Seu espelho é uma história do seu dia. Revisar é cuidar da própria rotina.', 'ponto', 1],
  ['ponto-05', 'Uma boa prática por vez. O mapa fica mais bonito quando você participa.', 'ponto', 2],
  ['ponto-06', 'Seu progresso não precisa fazer barulho para existir.', 'motivação', 3],
  ['ponto-07', 'Peças pequenas, progresso real. Continue montando seu quadro.', 'motivação', 4],
  ['ponto-08', 'O próximo nó está logo ali. Faça o que cabe neste momento.', 'motivação', 0],
  ['ponto-09', 'Lembrete gentil: cuidar do horário também é cuidar dos seus limites.', 'ponto', 1],
  ['ponto-10', 'Seu tempo merece registro, atenção e um pouco de leveza.', 'ponto', 2],
  ['ponto-11', 'Quando uma tarefa terminar, comemore o pequeno fechamento.', 'organização', 3],
  ['ponto-12', 'Uma pausa para olhar longe pode renovar a atenção.', 'bem-estar', 4],
  ['ponto-13', 'O mascote consultou o mapa: você está mais perto do que parece.', 'motivação', 0],
  ['ponto-14', 'Não é corrida. É jornada. Caminhe no ritmo que funciona para você.', 'motivação', 1],
  ['ponto-15', 'Se puder, deixe a próxima tarefa preparada antes de encerrar a atual.', 'organização', 2],
  ['ponto-16', 'Gentileza também é uma boa prática: consigo e com os colegas.', 'gratidão', 3],
  ['ponto-17', 'Seu relógio não julga; ele só acompanha o caminho.', 'humor', 4],
  ['ponto-18', 'O melhor horário para começar uma boa prática é o próximo possível.', 'motivação', 0],
  ['ponto-19', 'Uma batida certa de cada vez, um dia mais organizado de cada vez.', 'ponto', 1],
  ['ponto-20', 'Você não precisa carregar o dia inteiro agora. Cuide do próximo minuto.', 'bem-estar', 2],
  ['ponto-21', 'Missão discreta do dia: reconhecer algo que funcionou bem.', 'gratidão', 3],
  ['ponto-22', 'O mapa tem curvas, mas o progresso continua sendo progresso.', 'motivação', 4],
  ['ponto-23', 'Seu próximo passo pode ser pequeno e ainda assim importante.', 'motivação', 0],
  ['ponto-24', 'Organizar o tempo não é apertá-lo; é abrir espaço para o essencial.', 'organização', 1],
  ['ponto-25', 'O mascote recomenda uma pausa sem tela por alguns instantes.', 'bem-estar', 2],
  ['ponto-26', 'Hoje também conta aquilo que você decidiu não fazer agora.', 'organização', 3],
  ['ponto-27', 'O caminho fica mais leve quando a gente não precisa percorrê-lo sozinho.', 'gratidão', 4],
  ['ponto-28', 'Peça conquistada: você está construindo consistência.', 'ponto', 0],
  ['ponto-29', 'Seu quadro não precisa ficar pronto hoje para já ser bonito.', 'motivação', 1],
  ['ponto-30', 'O tempo é companheiro quando recebe atenção sem cobrança.', 'bem-estar', 2],
  ['ponto-31', 'Uma pergunta útil: o que pode esperar até amanhã?', 'organização', 3],
  ['ponto-32', 'O próximo passo tem mais valor do que a preocupação com o último.', 'motivação', 4],
  ['ponto-33', 'Se o dia apertar, reduza o passo, não a gentileza.', 'bem-estar', 0],
  ['ponto-34', 'O relógio sorriu: você chegou até aqui.', 'humor', 1],
  ['ponto-35', 'A melhor rotina é aquela que cabe na vida real.', 'organização', 2],
  ['ponto-36', 'Um intervalo bem cuidado ajuda a voltar com presença.', 'bem-estar', 3],
  ['ponto-37', 'Toda semana tem um cenário novo para explorar.', 'motivação', 4],
  ['ponto-38', 'Seu progresso merece ser visto, mesmo quando é silencioso.', 'gratidão', 0],
  ['ponto-39', 'O mapa não pede pressa, só presença no próximo nó.', 'motivação', 1],
  ['ponto-40', 'Hoje é um bom dia para deixar uma coisa simples mais organizada.', 'organização', 2],
  ['ponto-41', 'O mascote lembrou: respirar também é uma forma de recomeçar.', 'bem-estar', 3],
  ['ponto-42', 'Você está montando mais do que uma imagem: está montando uma rotina.', 'ponto', 4],
  ['ponto-43', 'Uma boa prática compartilhada vira incentivo para todo mundo.', 'gratidão', 0],
  ['ponto-44', 'O próximo pedaço do caminho aparece quando você continua.', 'motivação', 1],
  ['ponto-45', 'Menos ruído, mais clareza: escolha o que merece sua atenção.', 'organização', 2],
  ['ponto-46', 'Seu ritmo é válido. Ajustar o passo também é avançar.', 'bem-estar', 3],
  ['ponto-47', 'O relógio está de óculos escuros porque hoje o progresso está brilhando.', 'humor', 4],
  ['ponto-48', 'Cada pequeno cuidado deixa o dia um pouco mais habitável.', 'gratidão', 0],
  ['ponto-49', 'A jornada continua, mesmo quando a tela fica quieta.', 'motivação', 1],
  ['ponto-50', 'Feche uma etapa, respire e escolha a próxima com calma.', 'organização', 2],
  ['ponto-51', 'Seu tempo não é uma prova. É um espaço para viver e trabalhar.', 'bem-estar', 3],
  ['ponto-52', 'O quadro surpresa está sendo montado por escolhas reais do seu dia.', 'ponto', 4],
  ['ponto-53', 'A constância de hoje pode ser a tranquilidade de amanhã.', 'motivação', 0],
  ['ponto-54', 'O mascote manda um aceno para quem está fazendo o possível.', 'gratidão', 1],
  ['ponto-55', 'Um passo claro vale mais do que dez passos apressados.', 'organização', 2],
  ['ponto-56', 'O dia pode mudar de cenário sem mudar seu valor.', 'motivação', 3],
  ['ponto-57', 'Beba água, ajuste a postura e volte quando estiver pronto.', 'bem-estar', 4],
  ['ponto-58', 'O caminho tem espaço para pausas, curvas e novas tentativas.', 'motivação', 0],
  ['ponto-59', 'Você chegou a mais um nó. Que tal reconhecer isso?', 'gratidão', 1],
] as const;

export type MascotMessage = { id: string; texto: string; categoria: string; pose: number };
export const LOCAL_MASCOT_MESSAGES: MascotMessage[] = MASCOT_MESSAGES.map(([id, texto, categoria, pose]) => ({ id, texto, categoria, pose }));

export function getDailyMascotMessage(date: string): MascotMessage {
  const numeric = Number(date.replace(/-/g, '')) || 0;
  return LOCAL_MASCOT_MESSAGES[numeric % LOCAL_MASCOT_MESSAGES.length];
}

export function getJourneyImage(level: number) {
  return JOURNEY_IMAGES[(Math.max(1, level) - 1) % JOURNEY_IMAGES.length];
}
