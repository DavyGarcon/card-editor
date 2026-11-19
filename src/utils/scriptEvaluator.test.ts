import { describe, expect, it } from 'vitest';
import { evaluateFieldScript } from './scriptEvaluator';

const context = {
  card: { cost: '5', rarity: 'legendary' },
  style: { width: 375 },
  field: { id: 'badge' },
};

describe('evaluateFieldScript', () => {
  it('evaluates the documented example', () => {
    const result = evaluateFieldScript(
      `const cost = Number(card.cost || 0);
       return {
         text: \`Cost: \${cost}\`,
         color: cost >= 5 ? '#ef4444' : '#38bdf8',
         visible: cost > 0
       };`,
      context,
    );
    expect(result).toEqual({ text: 'Cost: 5', color: '#ef4444', visible: true });
  });

  it('supports nested ternaries from the starter pack', () => {
    const result = evaluateFieldScript(
      `return { color: card.rarity === 'legendary' ? '#f59e0b' : '#94a3b8' };`,
      context,
    );
    expect(result.color).toBe('#f59e0b');
  });

  it('treats a bare expression as text', () => {
    expect(evaluateFieldScript(`card.cost === '5'`, context).text).toBe('true');
  });

  it('blocks prototype and host access', () => {
    expect(
      evaluateFieldScript(`return card.constructor.constructor('return 1')();`, context).error,
    ).toBeTruthy();
    expect(evaluateFieldScript(`return window.location.href;`, context).error).toBeTruthy();
    expect(evaluateFieldScript(`return fetch('/secret');`, context).error).toBeTruthy();
  });

  it('only forwards primitive override keys', () => {
    const result = evaluateFieldScript(`return { color: '#fff', evil: { a: 1 }, x: 12 };`, context);
    expect(result).toEqual({ color: '#fff', x: 12 });
  });

  it('reports script errors instead of throwing', () => {
    expect(evaluateFieldScript(`return { color: unknownVar };`, context).error).toBeTruthy();
  });
});
