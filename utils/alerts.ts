import { DEFAULT_DAILY_LIMIT_MINUTES, formatMinutesHHMM } from './work-time';

export interface AlertThreshold {
  minutes: number;
  label: string;
  level: 'info' | 'warning' | 'urgent' | 'blocking';
  repeatEveryMinutes: number | null;
}

export interface WorkAlert extends AlertThreshold {
  active: boolean;
  remainingMinutes: number;
}

/** Marcos em minutos trabalhados: progresso normal, avisos e bloqueio. */
export const ALERT_THRESHOLDS: readonly AlertThreshold[] = [
  { minutes: 480, label: 'Jornada normal completa', level: 'info', repeatEveryMinutes: null },
  { minutes: 540, label: 'Atenção: 9 horas trabalhadas', level: 'warning', repeatEveryMinutes: null },
  { minutes: 570, label: 'Atenção: 9h30 trabalhadas', level: 'warning', repeatEveryMinutes: null },
  { minutes: 585, label: '9h45 trabalhadas', level: 'urgent', repeatEveryMinutes: 5 },
  { minutes: 590, label: '9h50 trabalhadas', level: 'urgent', repeatEveryMinutes: 1 },
  { minutes: 595, label: '9h55 trabalhadas', level: 'urgent', repeatEveryMinutes: 1 },
  { minutes: DEFAULT_DAILY_LIMIT_MINUTES, label: 'Limite diário atingido', level: 'blocking', repeatEveryMinutes: null },
];

function blockingThreshold(limitMinutes: number): AlertThreshold {
  return { minutes: limitMinutes, label: 'Limite diário atingido', level: 'blocking', repeatEveryMinutes: null };
}

export function getCurrentAlert(workedMinutes: number, limitMinutes = DEFAULT_DAILY_LIMIT_MINUTES): WorkAlert | null {
  const minutes = Math.max(0, Math.floor(workedMinutes));
  const limit = Math.max(1, Math.min(DEFAULT_DAILY_LIMIT_MINUTES, Math.floor(limitMinutes)));
  if (minutes >= limit) return { ...blockingThreshold(limit), active: true, remainingMinutes: 0 };
  const threshold = [...ALERT_THRESHOLDS].reverse().find((item) => item.minutes < limit && minutes >= item.minutes);
  if (!threshold) return null;
  return { ...threshold, active: true, remainingMinutes: Math.max(0, limit - minutes) };
}

/** Retorna os marcos já atingidos, do mais recente para o mais antigo. */
export function getReachedAlerts(workedMinutes: number, limitMinutes = DEFAULT_DAILY_LIMIT_MINUTES): WorkAlert[] {
  const minutes = Math.max(0, Math.floor(workedMinutes));
  const limit = Math.max(1, Math.min(DEFAULT_DAILY_LIMIT_MINUTES, Math.floor(limitMinutes)));
  const reached = ALERT_THRESHOLDS
    .filter((threshold) => threshold.minutes < limit && minutes >= threshold.minutes)
    .map((threshold) => ({ ...threshold, active: true, remainingMinutes: Math.max(0, limit - minutes) }));
  if (minutes >= limit) reached.push({ ...blockingThreshold(limit), active: true, remainingMinutes: 0 });
  return reached.reverse();
}

/** Decide se se deve repetir o aviso considerando o minuto transcorrido desde o primeiro disparo. */
export function shouldRepeatAlert(alertOrThreshold: WorkAlert | AlertThreshold, elapsedMinutes: number): boolean {
  const cadence = alertOrThreshold.repeatEveryMinutes;
  if (cadence === null || cadence <= 0 || elapsedMinutes < 0) return false;
  return elapsedMinutes > 0 && elapsedMinutes % cadence === 0;
}

export function describeAlert(workedMinutes: number, limitMinutes = DEFAULT_DAILY_LIMIT_MINUTES): string | null {
  const alert = getCurrentAlert(workedMinutes, limitMinutes);
  if (!alert) return null;
  return `${alert.label} (${formatMinutesHHMM(workedMinutes)}).`;
}
