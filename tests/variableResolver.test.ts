import { describe, expect, it } from 'vitest';
import {
  isValidHexColor,
  resolveStyleVariables,
  toSixDigitHex,
} from '../src/style/variableResolver';
import type { StyleVariable } from '../src/types/settings';

describe('variableResolver', () => {
  const vars: StyleVariable[] = [
    { id: '1', name: '主色调', value: '#1A73E8' },
    { id: '2', name: '正文色', value: '#333333' },
    { id: '3', name: '循环A', value: '{循环B}' },
    { id: '4', name: '循环B', value: '{循环A}' },
  ];

  it('replaces defined placeholders accurately (TC-07)', () => {
    const res = resolveStyleVariables(
      'color: {正文色}; border-left: 4px solid {主色调};',
      vars,
    );
    expect(res.resolved).toBe('color: #333333; border-left: 4px solid #1A73E8;');
    expect(res.undefinedVars).toEqual([]);
  });

  it('keeps undefined placeholders intact and reports warning names (TC-08)', () => {
    const res = resolveStyleVariables(
      'color: {不存在色}; background: {未知底色}; border-color: {不存在色};',
      vars,
    );
    expect(res.resolved).toBe(
      'color: {不存在色}; background: {未知底色}; border-color: {不存在色};',
    );
    expect(res.undefinedVars).toEqual(['不存在色', '未知底色']);
  });

  it('performs single-pass non-recursive replacement to prevent infinite loops', () => {
    const res = resolveStyleVariables('content: {循环A};', vars);
    expect(res.resolved).toBe('content: {循环B};');
    expect(res.undefinedVars).toEqual([]);
  });

  it('validates and normalizes 3-digit and 6-digit HEX colors', () => {
    expect(isValidHexColor('#369')).toBe(true);
    expect(isValidHexColor('#1A73E8')).toBe(true);
    expect(isValidHexColor('16px')).toBe(false);
    expect(isValidHexColor('{主色调}')).toBe(false);
    expect(toSixDigitHex('#369')).toBe('#336699');
    expect(toSixDigitHex('#1A73E8')).toBe('#1a73e8');
  });
});
