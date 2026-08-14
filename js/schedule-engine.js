/**
 * OliveBot — Schedule Engine
 *
 * Manages persistent study schedules derived from ROADMAP blocks.
 * Schedules are stored in localStorage per user. Each entry represents
 * one day's study task, expanded from the ROADMAP's week/phase structure.
 *
 * Key flows:
 *   1. AI emits <ROADMAP weeks='[...]'/> → renderer.js fires 'olivebot:roadmap' event
 *   2. app.js catches event → calls parseRoadmapToSchedule() → saveSchedule()
 *   3. On every app open → loadSchedule() → getTodayEntry() → nudge user
 *   4. User types "done" → isCompletionIntent() → markEntryComplete() → nudge next
 *   5. Overdue detected → detectOverdueEntries() → app triggers AI reschedule
 */

/* ── Constants ───────────────────────────────────────────── */

const STORAGE_PREFIX = 'olivebot_schedule_';

/* ── Storage ─────────────────────────────────────────────── */

/**
 * Save a schedule object to localStorage for a given userId.
 * @param {string} userId
 * @param {Object} schedule  — full schedule object (see schema below)
 */
export function saveSchedule(userId, schedule) {
  try {
    schedule.savedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(schedule));
  } catch (e) {
    console.warn('[ScheduleEngine] Failed to save schedule:', e.message);
  }
}

/**
 * Load a schedule from localStorage.
 * @param {string} userId
 * @returns {Object|null}
 */
export function loadSchedule(userId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[ScheduleEngine] Failed to load schedule:', e.message);
  }
  return null;
}

/**
 * Delete a schedule (e.g., when a new goal is confirmed).
 * @param {string} userId
 */
export function clearSchedule(userId) {
  localStorage.removeItem(STORAGE_PREFIX + userId);
}

/* ── Schedule Creation ───────────────────────────────────── */

/**
 * Parse a ROADMAP weeks array into a flat, day-by-day schedule object.
 *
 * Each week is expanded: if a phase spans N days, N entries are created,
 * each with a sequential date starting from today.
 *
 * Schema of each entry:
 *   { index, day, date, deadline, week, theme, focus, tags, priority, status }
 *
 * @param {Array}  weeks     — ROADMAP weeks array from AI
 * @param {string} examDate  — ISO date string of the exam
 * @param {string} goalName  — Human-readable exam name
 * @param {string} userId
 * @returns {Object} schedule
 */
export function parseRoadmapToSchedule(weeks, examDate, goalName, userId) {
  if (!Array.isArray(weeks) || weeks.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const examDateObj = examDate ? new Date(examDate) : null;
  const totalDaysUntilExam = examDateObj
    ? Math.max(1, Math.ceil((examDateObj - today) / 86400000))
    : weeks.length * 7; // Fallback: 7 days per week

  // Distribute days across phases proportionally based on weight
  const totalWeightedDays = weeks.reduce((sum, w) => sum + _phaseWeight(w, weeks.length), 0);
  const entries = [];
  let dayIndex = 0;

  for (const week of weeks) {
    const weight = _phaseWeight(week, weeks.length);
    const daysForPhase = Math.max(1, Math.round((weight / totalWeightedDays) * totalDaysUntilExam));

    for (let d = 0; d < daysForPhase; d++) {
      const entryDate = new Date(today);
      entryDate.setDate(today.getDate() + dayIndex);

      const deadline = new Date(entryDate);
      deadline.setHours(23, 59, 59, 999);

      entries.push({
        index: dayIndex,
        day: dayIndex + 1,
        date: entryDate.toISOString().split('T')[0],
        deadline: deadline.toISOString(),
        week: week.week,
        theme: week.theme || 'Study Session',
        focus: week.focus || '',
        tags: week.tags || [],
        priority: week.priority || '',
        status: 'pending',   // pending | completed | overdue
        completedAt: null,
      });
      dayIndex++;
    }
  }

  return {
    userId,
    goalName: goalName || 'Exam',
    examDate: examDate || null,
    generatedAt: new Date().toISOString(),
    savedAt: null,
    version: 1,
    entries,
  };
}

/**
 * Assign a day weight to a phase. Final phases (exam mode) get fewer days
 * since they're revision-only; foundation phases get more.
 */
function _phaseWeight(week, totalWeeks) {
  const prio = week.priority || '';
  if (prio === 'critical') return 1;          // Final stretch — fewer days
  if (prio === 'attention') return 1.5;
  if (week.week === totalWeeks) return 1;     // Last week = exam mode
  return 2;                                   // Foundation/regular phases
}

/* ── Entry Queries ───────────────────────────────────────── */

/**
 * Get today's schedule entry, or the earliest overdue entry, or null.
 * Prefers exact date match first, then earliest overdue.
 * @param {Object} schedule
 * @returns {Object|null} entry
 */
export function getTodayEntry(schedule) {
  if (!schedule || !Array.isArray(schedule.entries)) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  // Exact today match that is still pending
  const todayEntry = schedule.entries.find(
    e => e.date === todayStr && e.status === 'pending'
  );
  if (todayEntry) return todayEntry;

  // Earliest overdue pending entry
  const overdue = detectOverdueEntries(schedule);
  return overdue.length > 0 ? overdue[0] : null;
}

/**
 * Get the next pending entry after a given index.
 * @param {Object} schedule
 * @param {number} afterIndex
 * @returns {Object|null}
 */
export function getNextPendingEntry(schedule, afterIndex) {
  if (!schedule || !Array.isArray(schedule.entries)) return null;
  return schedule.entries.find(e => e.index > afterIndex && e.status === 'pending') || null;
}

/**
 * Return all entries where the deadline has passed and status is still 'pending'.
 * @param {Object} schedule
 * @returns {Array}
 */
export function detectOverdueEntries(schedule) {
  if (!schedule || !Array.isArray(schedule.entries)) return [];
  const now = new Date();
  return schedule.entries.filter(
    e => e.status === 'pending' && new Date(e.deadline) < now
  );
}

/**
 * Check whether the schedule is fully complete.
 * @param {Object} schedule
 * @returns {boolean}
 */
export function isScheduleComplete(schedule) {
  if (!schedule || !Array.isArray(schedule.entries)) return false;
  return schedule.entries.every(e => e.status === 'completed');
}

/**
 * Count completed vs total.
 * @param {Object} schedule
 * @returns {{ completed: number, total: number, pct: number }}
 */
export function getScheduleProgress(schedule) {
  if (!schedule || !Array.isArray(schedule.entries)) return { completed: 0, total: 0, pct: 0 };
  const total = schedule.entries.length;
  const completed = schedule.entries.filter(e => e.status === 'completed').length;
  return { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

/* ── Entry Mutation ──────────────────────────────────────── */

/**
 * Mark an entry as completed and persist to localStorage.
 * @param {string}  userId
 * @param {Object}  schedule
 * @param {number}  entryIndex
 * @returns {Object} Updated schedule
 */
export function markEntryComplete(userId, schedule, entryIndex) {
  const entry = schedule.entries.find(e => e.index === entryIndex);
  if (entry) {
    entry.status = 'completed';
    entry.completedAt = new Date().toISOString();
  }
  saveSchedule(userId, schedule);
  return schedule;
}

/**
 * Mark all pending-but-overdue entries as 'overdue' (not completed).
 * Call before regenerating a schedule to clean up the old one.
 * @param {string} userId
 * @param {Object} schedule
 * @returns {Object} Updated schedule
 */
export function stampOverdueEntries(userId, schedule) {
  const now = new Date();
  for (const entry of schedule.entries) {
    if (entry.status === 'pending' && new Date(entry.deadline) < now) {
      entry.status = 'overdue';
    }
  }
  saveSchedule(userId, schedule);
  return schedule;
}

/* ── Intent Detection ────────────────────────────────────── */

/**
 * Detect whether the user's message is a completion confirmation.
 * Matches: "done", "yes done", "completed it", "finished", "i'm done", "checked", etc.
 * @param {string} text
 * @returns {boolean}
 */
export function isCompletionIntent(text) {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  return /\b(done|finished|completed|i(?:'m| am) done|checked(?: it| off)?|all done|wrapped up|just finished|did it|yes done|yep done|task done|topic done|covered(?: it)?|studied(?: it)?)\b/.test(t);
}

/* ── Message Builders ────────────────────────────────────── */

/**
 * Build the daily nudge message shown when the app opens with a pending today's entry.
 * @param {Object} entry    — today's schedule entry
 * @param {Object} schedule — full schedule (for progress context)
 * @returns {string} Markdown message
 */
export function buildScheduleNudgeMessage(entry, schedule) {
  const progress = getScheduleProgress(schedule);
  const deadlineTime = new Date(entry.deadline).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });
  const tagsStr = entry.tags.length > 0 ? entry.tags.join(', ') : entry.theme;
  const progressLine = progress.total > 0
    ? `\n\n📊 **Progress:** ${progress.completed}/${progress.total} days completed (${progress.pct}%)`
    : '';

  const priorityEmoji = entry.priority === 'critical' ? '🔴' : entry.priority === 'attention' ? '🟡' : '📅';

  return `${priorityEmoji} **Day ${entry.day} of your ${schedule.goalName} plan**

Today's focus: **${entry.theme}**
${entry.focus ? `📌 ${entry.focus}` : ''}
🏷️ Topics: *${tagsStr}*
⏰ Complete by **${deadlineTime} tonight**${progressLine}

When you're done, just say **"done"** and I'll mark it complete and set up tomorrow's plan. 🎯`;
}

/**
 * Build the message shown when an overdue entry is detected on app open.
 * @param {Array}  overdueEntries — array of overdue entries
 * @param {Object} schedule
 * @returns {string} Markdown message
 */
export function buildOverdueNudgeMessage(overdueEntries, schedule) {
  const count = overdueEntries.length;
  const entryNames = overdueEntries
    .slice(0, 3)
    .map(e => `**${e.theme}** (Day ${e.day})`)
    .join(', ');

  const daysLeft = schedule.examDate
    ? Math.max(0, Math.ceil((new Date(schedule.examDate) - new Date()) / 86400000))
    : '?';

  return `⚠️ **Schedule check-in — let's catch up.**

${count > 1
    ? `You have **${count} pending topics** that weren't marked complete: ${entryNames}.`
    : `${entryNames} wasn't marked complete from earlier.`}

With **${daysLeft} days** left until **${schedule.goalName}**, the same syllabus needs to fit into less time. Let me rebuild a fresh, tighter schedule for you now — same topics, adjusted pacing.

Generating your updated plan... ⏳`;
}

/**
 * Build the completion celebration + next-step message.
 * @param {Object} completedEntry — the entry just marked done
 * @param {Object|null} nextEntry  — the next pending entry (or null if schedule complete)
 * @param {Object} schedule
 * @returns {string} Markdown message
 */
export function buildCompletionConfirmMessage(completedEntry, nextEntry, schedule) {
  const progress = getScheduleProgress(schedule);

  let msg = `✅ **Day ${completedEntry.day} done! ${completedEntry.theme} — marked complete.**\n\n`;

  if (nextEntry) {
    const nextDate = new Date(nextEntry.date);
    const isToday = nextEntry.date === new Date().toISOString().split('T')[0];
    const isTomorrow = !isToday &&
      nextDate.toDateString() === new Date(Date.now() + 86400000).toDateString();

    const whenStr = isToday ? 'later today' : isTomorrow ? 'tomorrow' : `on ${nextDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}`;
    const tagsStr = nextEntry.tags.length > 0 ? nextEntry.tags.join(', ') : nextEntry.theme;

    msg += `📅 **Up next (Day ${nextEntry.day}):** ${nextEntry.theme} — *${tagsStr}* — ${whenStr}\n\n`;
  } else if (isScheduleComplete(schedule)) {
    msg += `🎉 **You've completed your entire study schedule!** That's serious dedication. Trust the work you've put in.\n\n`;
  }

  msg += `📊 **Overall progress: ${progress.completed}/${progress.total} days done (${progress.pct}%)** — you're on track. 🔥`;
  return msg;
}


/* ── Daily Check-In (Proactive Nudge) ───────────────────── */

/**
 * Build the proactive coach check-in message for today's task.
 * Called on app open when today's entry is still pending.
 * @param {Object} entry    — today's schedule entry
 * @param {Object} schedule — full schedule
 * @returns {string} Markdown message
 */
export function buildDailyCheckinMessage(entry, schedule) {
  const progress = getScheduleProgress(schedule);
  const daysLeft = schedule.examDate
    ? Math.max(0, Math.ceil((new Date(schedule.examDate) - new Date()) / 86400000))
    : '?';

  const tagsStr = entry.tags.length > 0 ? entry.tags.join(', ') : entry.theme;
  const priorityEmoji = entry.priority === 'critical' ? '🔴' : entry.priority === 'attention' ? '🟡' : '🏋️';
  const progressLine = progress.total > 0
    ? `\n\n📊 Progress so far: **${progress.completed}/${progress.total} days done (${progress.pct}%)**`
    : '';

  return `${priorityEmoji} **Day ${entry.day} Check-in — ${schedule.goalName}**

You had **${entry.theme}** scheduled for today.\n📌 Topics: *${tagsStr}*

You've got **${daysLeft} days** left until your exam. Did you get through it? 💪

Reply **"yes"** if you're done, or tell me **how much you covered** (e.g. *"50%"*, *"just simplification"*, or *"0"* if you haven't started yet).${progressLine}`;
}


/* ── Intent Detection Helpers ────────────────────────────── */

/**
 * Detect if the user's reply is a NEGATIVE / incomplete response.
 * Matches: "no", "not yet", "nope", "didn't", "couldn't", "skipped", "0", "0%"
 * @param {string} text
 * @returns {boolean}
 */
export function isNegativeIntent(text) {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  return /\b(no|nope|not yet|didn'?t|couldn'?t|haven'?t|skipped|missed|didn't do|not done|zero|0%?|nothing)\b/.test(t);
}


/**
 * Parse a partial completion response from the user.
 * Handles: "50%", "half", "75 percent", "just simplification", "first two topics"
 * @param {string} text
 * @param {Object} entry — the schedule entry (used for topic names)
 * @returns {{ percentage: number|null, topics: string[] }}
 */
export function parsePartialCompletion(text) {
  if (!text) return { percentage: null, topics: [] };
  const t = text.toLowerCase();

  // Match percentage: "50%", "50 percent", "75%"
  const pctMatch = t.match(/(\d+)\s*(?:%|percent)/);
  if (pctMatch) {
    return { percentage: Math.min(100, Math.max(0, parseInt(pctMatch[1], 10))), topics: [] };
  }

  // Fractional words
  if (/\bhalf\b/.test(t)) return { percentage: 50, topics: [] };
  if (/\bquarter\b/.test(t)) return { percentage: 25, topics: [] };
  if (/\b(three.?quarter|75)\b/.test(t)) return { percentage: 75, topics: [] };
  if (/\b(almost|mostly|most of it)\b/.test(t)) return { percentage: 80, topics: [] };
  if (/\bfirst (half|part|section)\b/.test(t)) return { percentage: 50, topics: [] };

  // "just X" or "only X" → treat as named topic, estimate low completion
  const justMatch = t.match(/(?:just|only)\s+(.+)/);
  if (justMatch) {
    const topicName = justMatch[1].trim();
    return { percentage: null, topics: [topicName] };
  }

  // Couldn't parse — return null so caller asks again
  return { percentage: null, topics: [] };
}


/* ── Plan Redistribution ─────────────────────────────────── */

/**
 * Redistribute an incomplete schedule entry.
 * Marks the entry as "partial", and inserts/extends the next available
 * pending entry to carry the remaining topics.
 *
 * @param {string} userId
 * @param {Object} schedule    — full schedule object
 * @param {Object} entry       — the partially completed entry
 * @param {number} coveragePct — how much was done (0-100)
 * @returns {Object} Updated schedule
 */
export function redistributePartialEntry(userId, schedule, entry, coveragePct) {
  const remaining = Math.max(0, 100 - coveragePct);

  // Mark the entry as partial
  entry.status = 'partial';
  entry.coveragePct = coveragePct;
  entry.completedAt = new Date().toISOString();

  if (remaining <= 0) {
    // Actually fully done — just mark complete normally
    entry.status = 'completed';
    saveSchedule(userId, schedule);
    return schedule;
  }

  // Find the next 1-2 pending entries to absorb the remaining work
  const pendingEntries = schedule.entries.filter(e => e.status === 'pending' && e.index > entry.index);

  if (pendingEntries.length > 0) {
    const carryNote = `[Carried over: ${remaining}% of ${entry.theme}] `;
    const spreadCount = remaining >= 50 ? Math.min(2, pendingEntries.length) : 1;

    for (let i = 0; i < spreadCount; i++) {
      const target = pendingEntries[i];
      // Prepend carry-over note to the focus of the next day(s)
      target.focus = carryNote + (target.focus || target.theme);
      // Add the original entry's tags to the next day so student knows what to cover
      if (entry.tags && entry.tags.length > 0) {
        target.tags = [...new Set([...entry.tags, ...target.tags])];
      }
    }
  }

  saveSchedule(userId, schedule);
  return schedule;
}
