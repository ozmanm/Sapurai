import { describe, it, expect } from 'vitest';
import { fm, tcSum, fd } from '../format.js';

describe('fm (format money)', function () {
  it('formate 0 en "0 FCFA"', function () {
    expect(fm(0)).toBe('0 FCFA');
  });

  it('formate un nombre positif', function () {
    var result = fm(150000);
    expect(result).toContain('150');
    expect(result).toContain('000');
    expect(result).toContain('FCFA');
  });

  it('gere null/undefined comme 0', function () {
    expect(fm(null)).toBe('0 FCFA');
    expect(fm(undefined)).toBe('0 FCFA');
  });

  it('formate un nombre negatif', function () {
    var result = fm(-5000);
    expect(result).toContain('5');
    expect(result).toContain('000');
    expect(result).toContain('FCFA');
  });
});

describe('tcSum (resume conteneurs par type)', function () {
  it('retourne vide pour un tableau vide', function () {
    expect(tcSum([])).toBe('');
  });

  it('resume un seul type', function () {
    expect(tcSum([{ ty: '20GP' }, { ty: '20GP' }])).toBe('2 20GP');
  });

  it('resume plusieurs types', function () {
    var result = tcSum([{ ty: '20GP' }, { ty: '40HC' }, { ty: '20GP' }]);
    expect(result).toContain('2 20GP');
    expect(result).toContain('1 40HC');
  });

  it('gere les types manquants comme "?"', function () {
    var result = tcSum([{ ty: '20GP' }, {}]);
    expect(result).toContain('1 20GP');
    expect(result).toContain('1 ?');
  });
});

describe('fd (format date)', function () {
  it('retourne "---" pour une date absente', function () {
    expect(fd(null)).toBe('---');
    expect(fd(undefined)).toBe('---');
    expect(fd('')).toBe('---');
  });

  it('formate une date ISO', function () {
    var result = fd('2026-01-15');
    expect(result).toContain('15');
    expect(result).toContain('01');
    expect(result).toContain('2026');
  });
});
