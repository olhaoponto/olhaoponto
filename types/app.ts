export type UserRole = 'admin' | 'user';
export type PunchType = 'entrada' | 'saida_almoco' | 'volta_almoco' | 'saida';

export interface AlertPreferences {
  enabled?: boolean;
  before_minutes?: number;
  [key: string]: boolean | number | string | null | undefined;
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
