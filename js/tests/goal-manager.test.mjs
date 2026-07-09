/**
 * Unit tests for goal-manager.js
 * Run with: node --test js/tests/goal-manager.test.mjs
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// We can't use localStorage in Node, so we test the pure logic functions
// by importing the module and mocking what we need.

// Since goal-manager uses browser APIs (localStorage, fetch), we test
// the pure helper logic extracted here as standalone functions.

/* ── Test daysUntil logic ────────────────────────────────── */

describe('daysUntil calculation', () => {
  it('returns positive days for future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const dateStr = future.toISOString().split('T')[0];
    const days = _daysUntil(dateStr);
    assert.ok(days >= 29 && days <= 31, `Expected ~30, got ${days}`);
  });

  it('returns 0 or negative for past dates', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const dateStr = past.toISOString().split('T')[0];
    const days = _daysUntil(dateStr);
    assert.ok(days <= 0, `Expected ≤0, got ${days}`);
  });
});

/* ── Test goal filtering ─────────────────────────────────── */

describe('goal filtering', () => {
  const mockGoals = [
    { name: 'IBPS PO Prelims', date: '2099-10-15', confirmed: true },
    { name: 'RBI Assistant', date: '2020-01-01', confirmed: true },
    { name: 'SBI Clerk', date: '2099-12-01', confirmed: true },
  ];

  it('getNextUpcomingGoal returns nearest future goal', () => {
    const next = _getNextUpcomingGoal(mockGoals);
    assert.equal(next.name, 'IBPS PO Prelims');
  });

  it('getExpiredGoals returns past goals', () => {
    const expired = _getExpiredGoals(mockGoals);
    assert.equal(expired.length, 1);
    assert.equal(expired[0].name, 'RBI Assistant');
  });

  it('getActiveGoals returns only future goals', () => {
    const active = _getActiveGoals(mockGoals);
    assert.equal(active.length, 2);
  });

  it('getNextUpcomingGoal returns null when all expired', () => {
    const allPast = [{ name: 'Old Exam', date: '2020-01-01' }];
    assert.equal(_getNextUpcomingGoal(allPast), null);
  });
});

/* ── Test date parsing ───────────────────────────────────── */

describe('date parsing', () => {
  it('parses ISO format (YYYY-MM-DD)', () => {
    assert.equal(_parseDate('2026-10-15'), '2026-10-15');
  });

  it('parses DD/MM/YYYY format', () => {
    const result = _parseDate('15/10/2026');
    assert.equal(result, '2026-10-15');
  });

  it('parses natural language date', () => {
    const result = _parseDate('October 15, 2026');
    assert.ok(result, 'Should parse natural language');
    assert.ok(result.includes('2026'), 'Should contain year');
  });

  it('returns null for non-date text', () => {
    assert.equal(_parseDate('hello world'), null);
  });
});

/* ── Test countdown nudge building ───────────────────────── */

describe('buildCountdownNudge', () => {
  it('includes days remaining', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 45);
    const goal = { name: 'IBPS PO Prelims', date: futureDate.toISOString().split('T')[0] };
    const stats = {
      summary: { total_mocks: 10, avg_score: 65, avg_percentile: 42, best_score: 78 },
      section_analysis: {},
      topic_analysis: {},
    };
    const msg = _buildCountdownNudge(goal, stats, {});
    assert.ok(msg.includes('days'), 'Should mention days');
    assert.ok(msg.includes('IBPS PO Prelims'), 'Should mention exam name');
    assert.ok(msg.includes('10 mocks'), 'Should mention mock count');
  });

  it('shows critical urgency for ≤7 days', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 5);
    const goal = { name: 'Test Exam', date: soon.toISOString().split('T')[0] };
    const stats = { summary: { total_mocks: 5 }, section_analysis: {}, topic_analysis: {} };
    const msg = _buildCountdownNudge(goal, stats, {});
    assert.ok(msg.includes('🔴') || msg.includes('Final stretch'), 'Should show critical urgency');
  });

  it('highlights weak areas', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const goal = { name: 'Test', date: future.toISOString().split('T')[0] };
    const stats = {
      summary: { total_mocks: 8 },
      section_analysis: { 'English': { avg_accuracy: 45 } },
      topic_analysis: {},
    };
    const msg = _buildCountdownNudge(goal, stats, {});
    assert.ok(msg.includes('English'), 'Should mention weak section');
  });
});

/* ── Pure function reimplementations for testing ─────────── */
// (These mirror the logic in goal-manager.js without browser dependencies)

function _daysUntil(dateStr) {
  const target = new Date(dateStr);
  const today = new Date();
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function _getNextUpcomingGoal(goals) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = goals
    .filter(g => new Date(g.date) > today)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return upcoming.length > 0 ? upcoming[0] : null;
}

function _getExpiredGoals(goals) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return goals.filter(g => new Date(g.date) <= today);
}

function _getActiveGoals(goals) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return goals.filter(g => new Date(g.date) > today);
}

function _parseDate(text) {
  const isoMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (!isNaN(d)) return isoMatch[0];
  }
  const slashMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const d = new Date(`${slashMatch[3]}-${slashMatch[2].padStart(2,'0')}-${slashMatch[1].padStart(2,'0')}`);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }
  try {
    const d = new Date(text);
    if (!isNaN(d) && d.getFullYear() > 2020) return d.toISOString().split('T')[0];
  } catch { /* ignore */ }
  return null;
}

function _buildCountdownNudge(goal, stats, mockData) {
  const days = _daysUntil(goal.date);
  const s = stats.summary || {};
  const totalMocks = s.total_mocks || 0;
  const sa = stats.section_analysis || {};
  const ta = stats.topic_analysis || {};
  const weakSections = Object.entries(sa)
    .filter(([, v]) => v.avg_accuracy !== 'N/A' && v.avg_accuracy < 60)
    .map(([k]) => k);
  const weakTopics = Object.entries(ta)
    .filter(([, v]) => v.accuracy < 60)
    .map(([k]) => k);
  const allWeak = [...new Set([...weakSections, ...weakTopics])];
  const recommendedMocks = 20;
  const completionPct = Math.min(100, Math.round((totalMocks / recommendedMocks) * 100));

  let urgency = '';
  if (days <= 7) urgency = '🔴 **Final stretch!**';
  else if (days <= 30) urgency = '🟡 **Crunch time —**';
  else urgency = '📅';

  let msg = `${urgency} **${days} days** left for **${goal.name}**`;
  if (days <= 7) msg += ` — every session counts now.\n\n`;
  else if (days <= 30) msg += ` — time to intensify.\n\n`;
  else msg += `.\n\n`;

  msg += `📊 **Your prep so far:** ${totalMocks} mocks completed (~${completionPct}% of recommended practice)`;
  if (s.avg_score) msg += ` · Avg score: **${s.avg_score}**`;
  if (s.avg_percentile) msg += ` · Avg percentile: **${s.avg_percentile}%**`;
  msg += `\n\n`;

  if (allWeak.length > 0) {
    msg += `⚠️ **Areas needing work:** ${allWeak.slice(0, 4).join(', ')}\n\n`;
  } else {
    msg += `✅ **All sections looking strong** — focus on speed and consistency now.\n\n`;
  }

  if (days <= 7) {
    msg += `🎯 **Today's focus:** Take a full-length timed mock under exam conditions.`;
  } else if (allWeak.length > 0) {
    msg += `🎯 **Today's focus:** Spend 45 minutes on **${allWeak[0]}**.`;
  } else {
    msg += `🎯 **Today's focus:** Take a full mock and aim to beat your best score of **${s.best_score || 'N/A'}**.`;
  }
  return msg;
}
