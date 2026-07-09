/**
 * OliveBot — Goal Manager
 * Manages exam goal tracking: storage, countdown, nudges, and expired goal handling.
 * Goals are stored in localStorage keyed by userId and also attached to the in-memory data object.
 *
 * No databases. No long-term memory. Just localStorage + student JSON.
 */

import { getExamName } from './data-adapter.js';

/* ── Exam Calendar (loaded once) ─────────────────────────── */

let _examCalendar = null;

async function loadExamCalendar() {
  if (_examCalendar) return _examCalendar;
  try {
    const resp = await fetch('/data/exam-calendar.json');
    if (resp.ok) {
      _examCalendar = await resp.json();
    } else {
      _examCalendar = {};
    }
  } catch {
    _examCalendar = {};
  }
  return _examCalendar;
}

/* ── Storage Key ─────────────────────────────────────────── */

function _storageKey(mockData) {
  const uid = mockData.userid || mockData.username || 'default';
  return `olivebot_goals_${uid}`;
}

/* ── Public API ──────────────────────────────────────────── */

/**
 * Get all goals for a user. Reads from localStorage.
 * @param {Object} mockData
 * @returns {Array} Array of goal objects: { name, exam_key, date, confirmed }
 */
export function getGoals(mockData) {
  try {
    const raw = localStorage.getItem(_storageKey(mockData));
    if (raw) {
      const goals = JSON.parse(raw);
      return Array.isArray(goals) ? goals : [];
    }
  } catch { /* corrupted storage — return empty */ }
  return [];
}

/**
 * Save goals to localStorage.
 * @param {Object} mockData
 * @param {Array} goals
 */
export function saveGoals(mockData, goals) {
  localStorage.setItem(_storageKey(mockData), JSON.stringify(goals));
  // Also attach to in-memory data for prompt builder access
  mockData.goal_exams = goals;
}

/**
 * Check if user has any goals set.
 * @param {Object} mockData
 * @returns {boolean}
 */
export function hasGoals(mockData) {
  return getGoals(mockData).length > 0;
}

/**
 * Get the nearest upcoming (future) goal.
 * @param {Array} goals
 * @returns {Object|null}
 */
export function getNextUpcomingGoal(goals) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = goals
    .filter(g => new Date(g.date) > today)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return upcoming.length > 0 ? upcoming[0] : null;
}

/**
 * Get all goals whose date has passed (date <= today).
 * @param {Array} goals
 * @returns {Array}
 */
export function getExpiredGoals(goals) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return goals.filter(g => new Date(g.date) <= today);
}

/**
 * Get all still-upcoming goals.
 * @param {Array} goals
 * @returns {Array}
 */
export function getActiveGoals(goals) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return goals.filter(g => new Date(g.date) > today);
}

/**
 * Calculate days remaining until a date.
 * @param {string} dateStr
 * @returns {number}
 */
export function daysUntil(dateStr) {
  const target = new Date(dateStr);
  const today = new Date();
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Build the countdown nudge message shown on chatbot open.
 * Includes days left, weak areas, % completion estimate, and a focus action.
 *
 * @param {Object} goal   - { name, date }
 * @param {Object} stats  - Pre-computed stats
 * @param {Object} mockData
 * @returns {string}      - Markdown message for the bot to display
 */
export function buildCountdownNudge(goal, stats, mockData) {
  const days = daysUntil(goal.date);
  const s = stats.summary || {};
  const totalMocks = s.total_mocks || 0;

  // Weak areas
  const sa = stats.section_analysis || {};
  const ta = stats.topic_analysis || {};
  const weakSections = Object.entries(sa)
    .filter(([, v]) => v.avg_accuracy !== 'N/A' && v.avg_accuracy < 60)
    .map(([k]) => k);
  const weakTopics = Object.entries(ta)
    .filter(([, v]) => v.accuracy < 60)
    .map(([k]) => k);
  const allWeak = [...new Set([...weakSections, ...weakTopics])];

  // Estimate completion (rough: 20 mocks = well-prepared)
  const recommendedMocks = 20;
  const completionPct = Math.min(100, Math.round((totalMocks / recommendedMocks) * 100));

  // Urgency level
  let urgency = '';
  if (days <= 7) {
    urgency = '🔴 **Final stretch!**';
  } else if (days <= 30) {
    urgency = '🟡 **Crunch time —**';
  } else if (days <= 60) {
    urgency = '📅';
  } else {
    urgency = '📅';
  }

  // Build the message
  let msg = `${urgency} **${days} days** left for **${goal.name}**`;

  if (days <= 7) {
    msg += ` — every session counts now.\n\n`;
  } else if (days <= 30) {
    msg += ` — time to intensify.\n\n`;
  } else {
    msg += `.\n\n`;
  }

  // Stats snapshot
  msg += `📊 **Your prep so far:** ${totalMocks} mocks completed (~${completionPct}% of recommended practice)`;
  if (s.avg_score) msg += ` · Avg score: **${s.avg_score}**`;
  if (s.avg_percentile) msg += ` · Avg percentile: **${s.avg_percentile}%**`;
  msg += `\n\n`;

  // Weak areas
  if (allWeak.length > 0) {
    msg += `⚠️ **Areas needing work:** ${allWeak.slice(0, 4).join(', ')}\n\n`;
  } else {
    msg += `✅ **All sections looking strong** — focus on speed and consistency now.\n\n`;
  }

  // Focus action
  if (days <= 7) {
    msg += `🎯 **Today's focus:** Take a full-length timed mock under exam conditions. Review only the questions you got wrong.`;
  } else if (allWeak.length > 0) {
    msg += `🎯 **Today's focus:** Spend 45 minutes on **${allWeak[0]}** — do 20 targeted practice questions, then review every wrong answer.`;
  } else {
    msg += `🎯 **Today's focus:** Take a full mock and aim to beat your best score of **${s.best_score || 'N/A'}**.`;
  }

  return msg;
}

/**
 * Build message for expired goals.
 * @param {Object} goal
 * @returns {string}
 */
export function buildExpiredMessage(goal) {
  return `📋 Your **${goal.name}** exam date (${formatDate(goal.date)}) has passed. How did it go?\n\nIf you're targeting another exam, just tell me — I'll set up a new countdown and adjust your study plan. 💪`;
}

/**
 * Build the conversational ask message when no goals are set.
 * @param {string} examName - Auto-detected exam name from data
 * @returns {string}
 */
export function buildGoalAskMessage(examName) {
  return `By the way — are you targeting a specific exam date? I found you're preparing for **${examName}**. If you tell me the exam you're aiming for (e.g., "IBPS PO Prelims" or "RBI Assistant"), I can look up the date and build a countdown plan for you. 🎯`;
}

/**
 * Look up exam date from the curated calendar.
 * Tries to match by coursename key or by fuzzy name matching.
 *
 * @param {string} examQuery - Exam name or coursename key
 * @returns {Promise<Object|null>} - { name, estimated_date, cycle, track } or null
 */
export async function lookupExamDate(examQuery) {
  const calendar = await loadExamCalendar();
  if (!calendar || Object.keys(calendar).length === 0) return null;

  const query = examQuery.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Direct key match
  if (calendar[query]) {
    return calendar[query];
  }

  // Fuzzy match by name
  for (const [key, entry] of Object.entries(calendar)) {
    const entryName = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (entryName.includes(query) || query.includes(entryName) || query.includes(key)) {
      return entry;
    }
  }

  // Word-level partial match
  const queryWords = examQuery.toLowerCase().split(/\s+/);
  let bestMatch = null;
  let bestScore = 0;

  for (const [, entry] of Object.entries(calendar)) {
    const nameWords = entry.name.toLowerCase().split(/\s+/);
    const matchCount = queryWords.filter(w => nameWords.some(nw => nw.includes(w) || w.includes(nw))).length;
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestMatch = entry;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}

/**
 * Build a confirmation message after looking up a date.
 * @param {Object} examEntry - From lookupExamDate
 * @returns {string}
 */
export function buildDateConfirmation(examEntry) {
  const days = daysUntil(examEntry.estimated_date);
  const dateStr = formatDate(examEntry.estimated_date);

  if (days <= 0) {
    return `I found that **${examEntry.name}** was scheduled for **${dateStr}** — that date has already passed. Are you targeting the next cycle, or a different exam?`;
  }

  return `I found that **${examEntry.name}** is estimated for **${dateStr}** — that's **${days} days** from now.\n\nShall I set this as your goal? (Say **"yes"** to confirm, or tell me a different date/exam.)`;
}

/**
 * Try to auto-detect the exam from the student data's coursename.
 * @param {Object} mockData
 * @returns {Promise<Object|null>}
 */
export async function autoDetectExam(mockData) {
  const coursename = mockData.coursename || '';
  if (!coursename) return null;
  return lookupExamDate(coursename);
}

/* ── Helpers ─────────────────────────────────────────────── */

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
