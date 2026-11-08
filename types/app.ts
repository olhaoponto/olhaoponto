export type UserRole = 'admin' | 'user';
export type PunchType = 'entrada' | 'saida_almoco' | 'volta_almoco' | 'saida';
export type Workday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DayStatus = 'working' | 'rest' | 'absence' | 'medical_leave';

export interface WorkScheduleDayOverride {
  start_time?: string;
  end_time?: string;
  lunch_minutes?: number;
}

export interface WorkSchedule {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  lunch_minutes: number;
  /** Weekday numbers follow JavaScript: Sunday 0 through Saturday 6. */
  work_days: number[];
  /** Hours inside this same schedule can differ on a particular weekday. */
  day_overrides?: Partial<Record<Workday, WorkScheduleDayOverride>>;
}

export interface DayStatusRecord {
  user_id: string;
  data: string;
  status: DayStatus;
  atualizado_em: string;
  _pending?: boolean;
}

export interface BalanceAdjustment {
  id: string;
  user_id: string;
  saldo_minutos: number;
  motivo: string;
  criado_em: string;
}

export interface AgendaMeeting {
  id: string;
  title: string;
  starts_at: string;
  reminder_minutes: number;
}

export interface AlertPreferences {
  enabled?: boolean;
  before_minutes?: number;
  work_schedules?: WorkSchedule[];
  active_work_schedule_id?: string;
  lunch_return_warning_minutes?: number;
  rotacao_contador?: boolean;
  horario_almoco_previsto?: string;
  [key: string]: unknown;
}

export interface Profile {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  senha_provisoria: boolean;
  aceite_termos_em: string | null;
  aceite_termos_versao: string | null;
  almoco_minutos: number;
  limite_minutos: number;
  fuso: string;
  preferencias_alerta: AlertPreferences | null;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  /** Civil date in America/Bahia, formatted yyyy-MM-dd. */
  data: string;
  tipo: PunchType;
  registrado_em: string;
  horario_informado_manual: boolean;
  editado: boolean;
  justificativa: string | null;
  criado_em: string;
  atualizado_em: string;
}
