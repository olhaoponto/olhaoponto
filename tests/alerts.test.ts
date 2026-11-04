import { ALERT_THRESHOLDS, describeAlert, getCurrentAlert, getReachedAlerts, shouldRepeatAlert } from '../utils/alerts';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: unknown) => {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toHaveLength(expected: number): void;
  toMatchObject(expected: object): void;
};

describe('alerts', () => {
  it('configura todos os marcos solicitados e seleciona o nível atual', () => {
    expect(ALERT_THRESHOLDS.map((item) => item.minutes)).toEqual([480, 540, 570, 585, 590, 595, 600]);
    expect(getCurrentAlert(479)).toBe(null);
    expect(getCurrentAlert(480)).toMatchObject({ minutes: 480, level: 'info' });
    expect(getCurrentAlert(550)).toMatchObject({ minutes: 540, level: 'warning' });
    expect(getCurrentAlert(580)).toMatchObject({ minutes: 570, level: 'warning' });
    expect(getCurrentAlert(587)).toMatchObject({ minutes: 585, level: 'urgent', repeatEveryMinutes: 5 });
    expect(getCurrentAlert(592)).toMatchObject({ minutes: 590, level: 'urgent', repeatEveryMinutes: 1 });
    expect(getCurrentAlert(597)).toMatchObject({ minutes: 595, level: 'urgent', repeatEveryMinutes: 1 });
    expect(getCurrentAlert(600)).toMatchObject({ minutes: 600, level: 'blocking', remainingMinutes: 0 });
  });

  it('repete 9:45 a cada cinco minutos e 9:50/9:55 a cada minuto', () => {
    const nineFortyFive = ALERT_THRESHOLDS.find((threshold) => threshold.minutes === 585)!;
    const nineFifty = ALERT_THRESHOLDS.find((threshold) => threshold.minutes === 590)!;
    expect(shouldRepeatAlert(nineFortyFive, 5)).toBe(true);
    expect(shouldRepeatAlert(nineFortyFive, 4)).toBe(false);
    expect(shouldRepeatAlert(nineFifty, 1)).toBe(true);
    expect(shouldRepeatAlert(nineFifty, 2)).toBe(true);
    expect(shouldRepeatAlert(nineFifty, 0)).toBe(false);
    expect(shouldRepeatAlert(ALERT_THRESHOLDS[6], 1)).toBe(false);
  });

  it('fornece avisos atingidos e texto de apresentação', () => {
    expect(getReachedAlerts(595)).toHaveLength(6);
    expect(getReachedAlerts(595)[0]).toMatchObject({ minutes: 595, remainingMinutes: 5 });
    expect(describeAlert(585)).toBe('9h45 trabalhadas (09:45).');
    expect(describeAlert(200)).toBe(null);
  });
});
