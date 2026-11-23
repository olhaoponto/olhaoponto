import { describe, expect, it } from 'vitest';
import {
  isPreservedUserDataKey,
  isUserDataKey,
  partitionUserDataKeys,
  userDataKeyPrefix,
  userDataKeySuffix,
} from '@/utils/local-storage-keys';

const UID = 'user-1';
const key = (suffix: string) => `${userDataKeyPrefix(UID)}${suffix}`;

describe('nomes de chaves do usuário', () => {
  it('usa o namespace olhaponto:<uid>:', () => {
    expect(userDataKeyPrefix(UID)).toBe('olhaponto:user-1:');
  });

  it('reconhece as duas grafias do namespace', () => {
    expect(isUserDataKey('olhaponto:user-1:time-entries', UID)).toBe(true);
    expect(isUserDataKey('olhaoponto:user-1:avatar-escolhido', UID)).toBe(true);
    expect(isUserDataKey('olhaponto:other-user:time-entries', UID)).toBe(false);
    expect(isUserDataKey('olhaponto:user-10:time-entries', UID)).toBe(false);
    expect(isUserDataKey('some-other-storage', UID)).toBe(false);
  });

  it('retorna o sufixo depois de <uid>:', () => {
    expect(userDataKeySuffix(key('streak-best'), UID)).toBe('streak-best');
    expect(userDataKeySuffix('olhaoponto:user-1:sete-passos', UID)).toBe('sete-passos');
    expect(userDataKeySuffix('olhaponto:outra-pessoa:streak-best', UID)).toBe('');
  });
});

describe('chaves preservadas no logout', () => {
  const preservedSuffixes = [
    'avatar-escolhido',
    'avatares-vistos',
    'avatares-baseline',
    'pecas-total',
    'sete-passos',
    'achievements',
    'streak-best',
    'streak-milestones',
    'lunch-game',
    'mission-events:2026-11-16',
    'mission-events:2026-11-23',
  ];

  it.each(preservedSuffixes)('preserva %s', (suffix) => {
    expect(isPreservedUserDataKey(key(suffix), UID)).toBe(true);
  });

  it('preserva a grafia olhaoponto usada pelo avatar e pelo Sete Passos', () => {
    expect(isPreservedUserDataKey('olhaoponto:user-1:avatar-escolhido', UID)).toBe(true);
    expect(isPreservedUserDataKey('olhaoponto:user-1:sete-passos', UID)).toBe(true);
    expect(isPreservedUserDataKey('olhaoponto:user-1:pecas-total', UID)).toBe(true);
  });

  const removableSuffixes = [
    'time-entries',
    'pending-time-entries',
    'day-statuses',
    'day-occurrences',
    'ranking-pontos:month',
    'agenda-meetings',
    'calendar-preferences',
    'journey-state',
    'hidden-communications',
    'session-control-baseline',
    'avatares',
    'update-check-date',
    'welcome-message',
    'biometric',
    'profile',
  ];

  it.each(removableSuffixes)('apaga %s', (suffix) => {
    expect(isPreservedUserDataKey(key(suffix), UID)).toBe(false);
  });

  it('não preserva chave de outro usuário nem sufixo vazio', () => {
    expect(isPreservedUserDataKey('olhaponto:user-2:achievements', UID)).toBe(false);
    expect(isPreservedUserDataKey('olhaponto:user-1:', UID)).toBe(false);
  });
});

describe('partitionUserDataKeys', () => {
  it('separa o progresso do cache efêmero e ignora outras origens', () => {
    const keys = [
      key('time-entries'),
      key('pending-time-entries'),
      key('day-statuses'),
      key('achievements'),
      key('streak-best'),
      key('streak-milestones'),
      key('mission-events:2026-11-16'),
      'olhaoponto:user-1:avatar-escolhido',
      'olhaoponto:user-1:avatares-vistos',
      'olhaoponto:user-1:avatares-baseline',
      'olhaoponto:user-1:pecas-total',
      'olhaoponto:user-1:sete-passos',
      'olhaponto:user-2:achievements',
      'olhaponto:last-user',
      'expo.modules.asyncstorage.some.other',
    ];
    const { preserved, removable } = partitionUserDataKeys(keys, UID);
    expect(preserved.sort()).toEqual([
      'olhaoponto:user-1:avatar-escolhido',
      'olhaoponto:user-1:avatares-baseline',
      'olhaoponto:user-1:avatares-vistos',
      'olhaoponto:user-1:pecas-total',
      'olhaoponto:user-1:sete-passos',
      key('achievements'),
      key('mission-events:2026-11-16'),
      key('streak-best'),
      key('streak-milestones'),
    ].sort());
    expect(removable).toEqual([
      key('time-entries'),
      key('pending-time-entries'),
      key('day-statuses'),
    ]);
  });

  it('não remove nada quando o usuário só tem progresso', () => {
    const { preserved, removable } = partitionUserDataKeys([key('achievements'), key('streak-best')], UID);
    expect(removable).toEqual([]);
    expect(preserved).toHaveLength(2);
  });

  it('retorna listas vazias para usuário sem dados', () => {
    expect(partitionUserDataKeys(['olhaponto:outra:id:profile'], UID)).toEqual({ preserved: [], removable: [] });
  });

  it('mantém o comportamento crítico do relatório: logout não zera progresso local', () => {
    const stored = [
      'olhaoponto:user-1:avatar-escolhido',
      'olhaoponto:user-1:avatares-vistos',
      'olhaoponto:user-1:pecas-total',
      'olhaoponto:user-1:sete-passos',
      'olhaponto:user-1:avatares-baseline',
      'olhaponto:user-1:achievements',
      'olhaponto:user-1:streak-best',
      'olhaponto:user-1:streak-milestones',
      'olhaponto:user-1:mission-events:2026-11-16',
      'olhaponto:user-1:time-entries',
      'olhaponto:user-1:day-statuses',
      'olhaponto:user-1:pending-time-entries',
    ];
    const { removable } = partitionUserDataKeys(stored, UID);
    expect(removable).not.toContain('olhaoponto:user-1:avatar-escolhido');
    expect(removable).not.toContain('olhaponto:user-1:achievements');
    expect(removable).not.toContain('olhaponto:user-1:streak-best');
    expect(removable).toHaveLength(3);
  });
});
