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

export interface UserPresence {
  user_id: string;
  last_seen_at: string;
  active_recently: boolean;
}

export type BroadcastType = 'maintenance' | 'update' | 'announcement';

export interface BroadcastMessage {
  id: string;
  title: string;
  message: string;
  message_type: BroadcastType;
  active: boolean;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LunchColleague {
  id: string;
  nome: string;
}

export type LunchInviteStatus = 'pending' | 'accepted' | 'unavailable' | 'meeting';

export interface LunchInviteSummary {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_name: string;
  recipient_name: string;
  lunch_at: string;
  return_at: string;
  message: string;
  status: LunchInviteStatus;
  response_message: string | null;
  created_at: string;
  responded_at: string | null;
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
  ends_at?: string;
  calendar_id?: string;
  native_event_id?: string;
}

export interface AlertPreferences {
  enabled?: boolean;
  som?: boolean;
  vibracao?: boolean;
  before_minutes?: number;
  work_schedules?: WorkSchedule[];
  active_work_schedule_id?: string;
  lunch_return_warning_minutes?: number;
  lunch_reminder_minutes?: number;
  alerta_pausa_almoco?: boolean;
  alerta_retorno_almoco?: boolean;
  alerta_fim_jornada?: boolean;
  alerta_8h?: boolean;
  alerta_9h?: boolean;
  alerta_9h30?: boolean;
  alerta_9h45?: boolean;
  alerta_9h50?: boolean;
  alerta_9h55?: boolean;
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
