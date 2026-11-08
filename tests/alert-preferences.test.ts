import { describe, expect, it } from 'vitest';
import { getLunchReminderMinutes, isWorkAlertEnabled } from '../utils/alerts';

describe('preferências de alertas', () => {
  it('usa 4h por padrão e aceita apenas valores inteiros entre 60 e 480 minutos', () => {
    expect(getLunchReminderMinutes(undefined)).toBe(240);
    expect(getLunchReminderMinutes(60)).toBe(60);
    expect(getLunchReminderMinutes('300')).toBe(300);
    expect(getLunchReminderMinutes(480)).toBe(480);
    expect(getLunchReminderMinutes(59)).toBe(240);
    expect(getLunchReminderMinutes(481)).toBe(240);
    expect(getLunchReminderMinutes(240.5)).toBe(240);
  });

  it('respeita o toggle de cada marco sem desabilitar por padrão os avisos existentes', () => {
    expect(isWorkAlertEnabled(480, 600, {})).toBe(true);
    expect(isWorkAlertEnabled(540, 600, { alerta_9h: false })).toBe(false);
    expect(isWorkAlertEnabled(570, 600, { alerta_9h30: false })).toBe(false);
    expect(isWorkAlertEnabled(585, 600, { alerta_9h45: false })).toBe(false);
    expect(isWorkAlertEnabled(590, 600, { alerta_9h50: false })).toBe(false);
    expect(isWorkAlertEnabled(595, 600, { alerta_9h55: false })).toBe(false);
  });

  it('mantém sempre ativo o teto configurado e marcações acima dele', () => {
    expect(isWorkAlertEnabled(540, 540, { alerta_9h: false })).toBe(true);
    expect(isWorkAlertEnabled(600, 600, { enabled: false })).toBe(true);
  });
});
