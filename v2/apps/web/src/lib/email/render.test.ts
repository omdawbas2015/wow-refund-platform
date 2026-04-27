import { describe, it, expect } from 'vitest';
import { renderTemplate } from './render';

describe('lib/email/renderTemplate', () => {
  it('replaces single placeholder', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'Alice' })).toBe(
      'Hello Alice!',
    );
  });

  it('replaces multiple placeholders', () => {
    expect(
      renderTemplate('{{greeting}}, {{name}}!', {
        greeting: 'Hi',
        name: 'Bob',
      }),
    ).toBe('Hi, Bob!');
  });

  it('tolerates whitespace inside braces', () => {
    expect(renderTemplate('a {{ name }} b', { name: 'x' })).toBe('a x b');
  });

  it('renders missing keys as empty string', () => {
    expect(renderTemplate('Hello {{name}}', {})).toBe('Hello ');
  });

  it('renders null / undefined values as empty string', () => {
    expect(renderTemplate('Hello {{name}}', { name: null })).toBe('Hello ');
    expect(renderTemplate('Hello {{name}}', { name: undefined })).toBe('Hello ');
  });

  it('coerces numbers to strings', () => {
    expect(renderTemplate('You owe {{amount}} {{currency}}', {
      amount: 99.5,
      currency: 'KWD',
    })).toBe('You owe 99.5 KWD');
  });

  it('supports dotted keys', () => {
    // The implementation uses [\\w.]+ so dotted keys are looked up as a
    // single flat key in the variables map (no nesting).
    expect(
      renderTemplate('{{user.name}}', { 'user.name': 'Alice' }),
    ).toBe('Alice');
  });

  it('passes through text with no placeholders', () => {
    expect(renderTemplate('static body', {})).toBe('static body');
  });

  it('does not recurse into placeholder values', () => {
    // If a value contains another {{token}} we render it literally
    // (no double-pass) so there's no risk of template injection.
    expect(
      renderTemplate('{{x}}', { x: '{{evil}}' }),
    ).toBe('{{evil}}');
  });
});
