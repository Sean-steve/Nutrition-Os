import { describe, expect, it } from 'vitest';
import { calculateLoggedTotals, clampProgress, remaining, formatKes } from './nutrition';
import type { MealRecord } from './nutrition';

const record: MealRecord = {
  id: 'demo-1', slot: 'Breakfast', name: 'Eggs', details: 'Sample', time: '07:30',
  emoji: '🍳', energyKcal: 200, proteinG: 12, carbsG: 3, fatG: 15, status: 'logged',
};

describe('preview nutrition domain', () => {
  it('counts only logged meals, never plans as consumed', () => {
    const totals = calculateLoggedTotals([record, { ...record, id: 'demo-2', status: 'planned' }]);
    expect(totals.energyKcal).toBe(200);
    expect(totals.proteinG).toBe(12);
    expect(totals.loggedCount).toBe(1);
  });
  it('treats missing logs as no observation, not proven zero intake', () => {
    const totals = calculateLoggedTotals([]);
    expect(totals.hasObservations).toBe(false);
    expect(totals.loggedCount).toBe(0);
  });
  it('clamps percentage and handles invalid target', () => {
    expect(clampProgress(75, 100)).toBe(75);
    expect(clampProgress(200, 100)).toBe(100);
    expect(clampProgress(-1, 100)).toBe(0);
    expect(clampProgress(10, 0)).toBe(0);
  });
  it('never shows a negative remaining target', () => {
    expect(remaining(102, 100)).toBe(0);
    expect(remaining(70, 100)).toBe(30);
  });
  it('formats Kenyan currency for the household preview', () => {
    expect(formatKes(4850)).toBe('KES 4,850');
  });
});
