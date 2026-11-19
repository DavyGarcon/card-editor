import '@testing-library/jest-dom/vitest';

// jsdom has no canvas implementation; provide deterministic text metrics.
HTMLCanvasElement.prototype.getContext = (() => ({
  font: '',
  measureText: (text: string) => ({ width: text.length * 8 }),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
