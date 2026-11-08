import { formatInTimeZone } from 'date-fns-tz';

export type MascotTheme = 'base' | 'christmas' | 'newyear' | 'carnival' | 'junina';

export interface DailyWelcome {
  dateKey: string;
  greeting: string;
  seasonLabel: string;
  message: string;
  theme: MascotTheme;
}

const TIME_ZONE = 'America/Bahia';
const DAY_MS = 24 * 60 * 60 * 1000;

const messages: Record<MascotTheme, { label: string; lines: string[] }> = {
  base: {
    label: 'MENSAGEM DO DIA',
    lines: [
      'Um passo de cada vez já é progresso. Respeite o seu ritmo.',
      'Cuidar do seu tempo também faz parte de um bom dia de trabalho.',
      'Pequenas pausas ajudam a atravessar a jornada com mais leveza.',
      'Hoje, organize a jornada com calma. Siga com atenção, uma tarefa por vez.',
      'Seu esforço merece equilíbrio: foco no trabalho e espaço para descansar.',
      'Uma pausa na hora certa também faz parte de um dia bem cuidado.',
      'Faça o que está ao seu alcance hoje; o progresso não precisa ser apressado.',
    ],
  },
  christmas: {
    label: 'TEMPO DE NATAL',
    lines: [
      'Que esta época traga leveza à sua jornada e bons momentos de descanso.',
      'Feche o ano no seu ritmo: uma pausa bem cuidada também é um presente.',
      'Boas festas! Cuide do seu tempo e aproveite os momentos fora do trabalho.',
    ],
  },
  newyear: {
    label: 'UM NOVO CICLO',
    lines: [
      'Um novo ciclo começa com passos possíveis e pausas bem cuidadas.',
      'Que o próximo ciclo tenha trabalho com propósito e descanso de verdade.',
      'Renove as metas sem esquecer de reservar tempo para você.',
    ],
  },
  carnival: {
    label: 'CLIMA DE CARNAVAL',
    lines: [
      'Celebre com equilíbrio: cada parte do dia merece o seu próprio ritmo.',
      'Entre uma tarefa e outra, lembre-se de respirar e fazer uma pausa.',
      'Aproveite o dia com leveza e preserve também o seu tempo de descanso.',
    ],
  },
  junina: {
    label: 'FESTA JUNINA',
    lines: [
      'Faça sua jornada no seu ritmo. Que seu dia tenha aconchego e alegria!',
      'Entre uma tarefa e outra, uma pausa bem feita ajuda a renovar o ânimo.',
      'Que o seu dia tenha trabalho com atenção e momentos leves para celebrar.',
    ],
  },
};

function easterSundayUtc(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}

function dateKeyToUtcMs(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return ms;
}

export function getMascotThemeForDateKey(dateKey: string): MascotTheme {
  const dateMs = dateKeyToUtcMs(dateKey);
  if (dateMs === null) return 'base';
  const [, yearText, monthText, dayText] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)!;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if ((month === 12 && day === 31) || (month === 1 && day === 1)) return 'newyear';
  if (month === 12 && day >= 20 && day <= 26) return 'christmas';
  if (month === 6 && day >= 19 && day <= 24) return 'junina';

  const carnivalTuesday = easterSundayUtc(year) - 47 * DAY_MS;
  const dayFromCarnivalTuesday = Math.round((dateMs - carnivalTuesday) / DAY_MS);
  if (dayFromCarnivalTuesday >= -2 && dayFromCarnivalTuesday <= 1) return 'carnival';
  return 'base';
}

function stableIndex(key: string, length: number): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

export function getDailyWelcome(date: Date = new Date()): DailyWelcome {
  const dateKey = formatInTimeZone(date, TIME_ZONE, 'yyyy-MM-dd');
  const theme = getMascotThemeForDateKey(dateKey);
  const hour = Number(formatInTimeZone(date, TIME_ZONE, 'H'));
  const greeting = hour < 12 ? 'Bom dia!' : hour < 18 ? 'Boa tarde!' : 'Boa noite!';
  const themeMessages = messages[theme];
  return {
    dateKey,
    greeting,
    seasonLabel: themeMessages.label,
    message: themeMessages.lines[stableIndex(dateKey, themeMessages.lines.length)],
    theme,
  };
}
