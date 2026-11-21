import { describe, expect, it } from 'vitest';
import { getAvatarAnnouncement } from '@/utils/avatar-unlock-state';

describe('estado de avisos de avatares', () => {
  it('marca os já desbloqueados no baseline sem avisar', () => {
    expect(getAvatarAnnouncement({ baselineDone: false, unlockedIds: ['av-01', 'av-02'], seenIds: [] })).toEqual({ baselineIds: ['av-01', 'av-02'], announceIds: [] });
  });

  it('avisa uma vez o avatar desbloqueado depois do baseline', () => {
    expect(getAvatarAnnouncement({ baselineDone: true, unlockedIds: ['av-01', 'av-02'], seenIds: ['av-01'] }).announceIds).toEqual(['av-02']);
  });

  it('não reapresenta o avatar depois que ele foi visto', () => {
    expect(getAvatarAnnouncement({ baselineDone: true, unlockedIds: ['av-02'], seenIds: ['av-02'] }).announceIds).toEqual([]);
  });
});
