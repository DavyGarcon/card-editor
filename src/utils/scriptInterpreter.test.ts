import { describe, expect, it } from 'vitest';
import { interpretScript, ScriptSyntaxError } from './scriptInterpreter';

describe('interpretScript', () => {
  it('evaluates if/else blocks', () => {
    const script = 'if (card.hp > 3) { return "high"; } else { return "low"; }';
    expect(interpretScript(script, { card: { hp: 5 } })).toBe('high');
    expect(interpretScript(script, { card: { hp: 1 } })).toBe('low');
  });

  it('supports declarations and nested blocks without a trailing semicolon', () => {
    const script = 'const x = 2;\nif (x === 2) { const y = x + 1; return y; }';
    expect(interpretScript(script, {})).toBe(3);
  });

  it('reports a 1-based line number for runtime errors', () => {
    try {
      interpretScript('const x = 1;\nunknownVariable;', {});
      expect.unreachable('Expected a ScriptSyntaxError');
    } catch (error) {
      expect(error).toBeInstanceOf(ScriptSyntaxError);
      const syntaxError = error as ScriptSyntaxError;
      expect(syntaxError.line).toBe(2);
      expect(syntaxError.message).toMatch(/ligne 2/);
    }
  });

  it('rejects malformed numeric literals', () => {
    expect(() => interpretScript('return 1..2;', {})).toThrow(ScriptSyntaxError);
    expect(interpretScript('return 1.5e2;', {})).toBe(150);
  });

  it('keeps independent step budgets between calls', () => {
    const script = 'return Math.max(1, 2, 3);';
    expect(interpretScript(script, {})).toBe(3);
    expect(interpretScript(script, {})).toBe(3);
  });
});
