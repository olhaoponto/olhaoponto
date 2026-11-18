import { describe, expect, it } from 'vitest';
import { chooseDefaultLunchSlot, generateLunchSlots, validateLunchAt } from '../utils/lunch-slots';

const zone = 'America/Bahia';

function nowAt(value: string): Date {
  return new Date(`${value}-03:00`);
}

describe('lunch slots', () => {
  it('arredonda para o próximo quarto de hora após quinze minutos', () => {
    const slots = generateLunchSlots(nowAt('2026-11-18T09:03:00'), zone);
    expect(slots[0].label).toBe('09:30');
    expect(slots[1].label).toBe('09:45');
  });

  it('atravessa corretamente a virada de hora', () => {
    const slots = generateLunchSlots(nowAt('2026-11-18T09:53:00'), zone);
    expect(slots.slice(0, 3).map((slot) => slot.label)).toEqual(['10:15', '10:30', '10:45']);
  });

  it('escolhe por padrão o horário disponível mais próximo de meio-dia', () => {
    const slots = generateLunchSlots(nowAt('2026-11-18T09:03:00'), zone);
    expect(chooseDefaultLunchSlot(slots, zone)?.label).toBe('12:00');
    const afterNoon = generateLunchSlots(nowAt('2026-11-18T12:03:00'), zone);
    expect(chooseDefaultLunchSlot(afterNoon, zone)?.label).toBe('12:30');
  });

  it('limita os horários ao intervalo de quatro horas', () => {
    const slots = generateLunchSlots(nowAt('2026-11-18T09:03:00'), zone);
    expect(slots.at(-1)?.label).toBe('13:15');
    expect(slots.some((slot) => slot.label === '13:30')).toBe(false);
  });

  it('valida passado e antecedência mínima de dez minutos', () => {
    const now = nowAt('2026-11-18T09:03:00');
    expect(validateLunchAt(nowAt('2026-11-18T09:02:00'), now)).toContain('já passou');
    expect(validateLunchAt(nowAt('2026-11-18T09:12:00'), now)).toContain('10 minutos');
    expect(validateLunchAt(nowAt('2026-11-18T09:13:00'), now)).toBeNull();
  });
});
