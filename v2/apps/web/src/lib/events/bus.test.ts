import { describe, it, expect, vi } from 'vitest';
import { publish, subscribe } from './bus';

describe('lib/events/bus', () => {
  it('delivers published events to subscribers of the same user', () => {
    const fn = vi.fn();
    const unsub = subscribe('user-1', fn);
    publish('user-1', { type: 'case.update', data: { id: 'c1' } });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ type: 'case.update', data: { id: 'c1' } });
    unsub();
  });

  it('isolates events between users', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribe('user-A', a);
    const unsubB = subscribe('user-B', b);
    publish('user-A', { type: 'ping', data: {} });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    unsubA();
    unsubB();
  });

  it('unsubscribe stops delivery', () => {
    const fn = vi.fn();
    const unsub = subscribe('user-X', fn);
    publish('user-X', { type: 'one', data: {} });
    unsub();
    publish('user-X', { type: 'two', data: {} });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('multiple subscribers all receive', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribe('user-multi', a);
    const unsubB = subscribe('user-multi', b);
    publish('user-multi', { type: 'fanout', data: { n: 1 } });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubA();
    unsubB();
  });
});
