import { describe, expect, it } from 'vitest';
import { compareVersions, isVersionNewer } from '@/utils/version-compare';

describe('version compare', () => {
  it('considera 1.3.2 mais nova que 1.3.1', () => {
    expect(isVersionNewer('1.3.2', '1.3.1')).toBe(true);
  });

  it('compara cada componente numericamente', () => {
    expect(isVersionNewer('1.10.0', '1.9.0')).toBe(true);
  });

  it('reconhece versões iguais e tags com v', () => {
    expect(compareVersions('v1.3.2', '1.3.2')).toBe(0);
    expect(isVersionNewer('v1.3.2', '1.3.2')).toBe(false);
  });

  it('retorna null e não sinaliza atualização para valores inválidos', () => {
    expect(compareVersions('latest', '1.3.1')).toBeNull();
    expect(isVersionNewer('latest', '1.3.1')).toBe(false);
    expect(isVersionNewer('1.3.2', 'dev')).toBe(false);
  });
});
