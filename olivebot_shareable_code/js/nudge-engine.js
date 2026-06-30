/**
 * OliveBot — Nudge Engine
 * Proactively generates contextual nudges to push students toward progress.
 * Analyzes pre-computed stats and surfaces the most impactful actions.
 */

/* ── State ───────────────────────────────────────────────── */

let idleTimer = null;

/* ── Public API ──────────────────────────────────────────── */

/**
 * Analyze student data and generate prioritized nudges.
 * @param {Object} mockData - Parsed mock test JSON
 * @param {Object} stats    - Pre-computed stats from stats-engine.js
 * @returns {Array}         - Sorted array of nudge objects (highest priority first)
 */
export function generateNudges(mockData, stats) {
  const nudges = [];

  nudges.push(...checkWeakAreas(stats));
  nudges.push(...checkDecline(stats));
  nudges.push(...checkCountdown(mockData));
  nudges.push(...checkMockFrequency(mockData, stats));
  nudges.push(...checkProgress(stats));

  // Sort by priority (highest first)
  nudges.sort((a, b) => b.priority - a.priority);

  return nudges;
}

/**
 * Schedule an idle nudge that fires after `delaySec` seconds of inactivity.
 * @param {Function} displayFn - Function to call with the idle nudge HTML
 * @param {number}   delaySec  - Seconds to wait before showing (default 45)
 */
export function scheduleIdleNudge(displayFn, delaySec = 45) {
  cancelIdleNudge();
  idleTimer = setTimeout(() => {
    const card = renderNudgeCard({
      type: 'idle',
      icon: '💡',
      title: 'Not sure where to start?',
      message: 'Try asking about your weak areas or take a quick mini quiz to warm up.',
      cta: { label: 'Show my weak areas', prompt: 'What are my weak areas?' },
    });
    displayFn(card);
  }, delaySec * 1000);
}

/**
 * Cancel a pending idle nudge (e.g., when the user interacts).
 */
export function cancelIdleNudge() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/**
 * Render an array of nudge objects into a single HTML string.
 * @param {Array} nudges - Nudge objects from generateNudges()
 * @param {number} max   - Maximum nudges to render (default 2)
 * @returns {string}     - HTML string of nudge cards
 */
export function renderNudgeCards(nudges, max = 2) {
  return nudges
    .slice(0, max)
    .map(n => renderNudgeCard(n))
    .join('');
}

/* ── Nudge Generators ────────────────────────────────────── */

/**
 * 🔴 Weak Area Alarm — topics below 50% accuracy
 */
function checkWeakAreas(stats) {
  const nudges = [];
  const ta = stats.topic_analysis || {};
  const sa = stats.section_analysis || {};

  // Check topic-level
  const weakTopics = Object.entries(ta)
    .filter(([, v]) => v.accuracy < 50)
    .sort((a, b) => a[1].accuracy - b[1].accuracy);

  if (weakTopics.length > 0) {
    const worst = weakTopics[0];
    const count = weakTopics.length;
    nudges.push({
      type: 'weak_area',
      icon: '🔴',
      title: `${worst[0]} accuracy is at ${worst[1].accuracy}%`,
      message: count > 1
        ? `You have ${count} topics below 50% accuracy. Your weakest is **${worst[0]}**. Addressing this first will have the highest impact on your score.`
        : `**${worst[0]}** is dragging your score down at just ${worst[1].accuracy}% accuracy. A focused recovery session can turn this around.`,
      cta: { label: 'Build recovery plan →', prompt: `Give me a detailed recovery plan for ${worst[0]}` },
      priority: 90,
    });
  }

  // Check section-level (Oliveboard format)
  const weakSections = Object.entries(sa)
    .filter(([, v]) => v.avg_accuracy !== 'N/A' && v.avg_accuracy < 50)
    .sort((a, b) => a[1].avg_accuracy - b[1].avg_accuracy);

  if (weakSections.length > 0 && weakTopics.length === 0) {
    const worst = weakSections[0];
    nudges.push({
      type: 'weak_area',
      icon: '🔴',
      title: `${worst[0]} section is at ${worst[1].avg_accuracy}%`,
      message: `Your **${worst[0]}** section accuracy is below the danger zone. Let's focus here to maximize your score gains.`,
      cta: { label: 'Analyze weak areas →', prompt: 'What are my weak areas?' },
      priority: 88,
    });
  }

  return nudges;
}



/**
 * 📉 Decline Alert — recent scores dropping vs. early scores
 */
function checkDecline(stats) {
  const nudges = [];
  const s = stats.summary || {};

  if (s.rolling_trend_vs_first3 < -3) {
    nudges.push({
      type: 'decline',
      icon: '📉',
      title: `Scores dipped by ${s.rolling_trend_vs_first3} points`,
      message: `Your recent mocks are trending **${s.rolling_trend_vs_first3} points** below your early ones. This could be fatigue, harder mocks, or a concept gap. Let's diagnose it.`,
      cta: { label: 'Diagnose the dip →', prompt: 'Compare my recent mocks vs early mocks. Why are my scores dropping?' },
      priority: 85,
    });
  }

  return nudges;
}
/**
 * ⏰ Countdown Pressure — exam is approaching
 */
function checkCountdown(mockData) {
  const nudges = [];

  if (mockData._format !== 'custom' || !mockData.user?.exam_date) return nudges;

  const daysLeft = Math.ceil((new Date(mockData.user.exam_date) - new Date()) / 86400000);

  if (daysLeft > 0 && daysLeft <= 60) {
    const urgencyLevel = daysLeft <= 14 ? 'critical' : daysLeft <= 30 ? 'high' : 'moderate';
    const emoji = daysLeft <= 14 ? '🚨' : '⏰';

    nudges.push({
      type: 'countdown',
      icon: emoji,
      title: `${daysLeft} days until your exam`,
      message: daysLeft <= 14
        ? `Only **${daysLeft} days left**. Every session counts now. Focus exclusively on your weakest 2-3 topics and take timed mocks daily.`
        : `**${daysLeft} days to go.** Let's make sure you're on track with a structured study roadmap for the final stretch.`,
      cta: { label: 'Build sprint plan →', prompt: 'Study roadmap' },
      priority: urgencyLevel === 'critical' ? 95 : urgencyLevel === 'high' ? 80 : 70,
    });
  }

  return nudges;
}

/**
 * 🎯 Mock Frequency Nudge — not practicing enough
 */
function checkMockFrequency(mockData, stats) {
  const nudges = [];
  const dateRange = stats.date_range || {};

  if (!dateRange.from || dateRange.from === 'N/A') return nudges;

  const fromDate = new Date(dateRange.from);
  const toDate = new Date(dateRange.to || Date.now());
  const weeks = Math.max(1, (toDate - fromDate) / (7 * 86400000));
  const totalMocks = stats.summary?.total_mocks || 0;
  const mocksPerWeek = totalMocks / weeks;

  if (mocksPerWeek < 2 && totalMocks >= 3) {
    nudges.push({
      type: 'frequency',
      icon: '🎯',
      title: `Averaging ${mocksPerWeek.toFixed(1)} mocks/week`,
      message: `Top scorers typically take 3-4 mocks per week. You're at **${mocksPerWeek.toFixed(1)}/week**. Consistency beats cramming — ready for a quick practice round?`,
      cta: { label: 'Take a mini quiz →', prompt: 'Recommend a mock test for my weakest area' },
      priority: 60,
    });
  }

  return nudges;
}

/**
 * 🏆 Streak & Progress Celebration
 */
function checkProgress(stats) {
  const nudges = [];
  const s = stats.summary || {};

  if (s.improvement_points > 5) {
    nudges.push({
      type: 'progress',
      icon: '🏆',
      title: `+${s.improvement_points} points since Mock 1`,
      message: `You've climbed **${s.improvement_points} points** from your first mock. That's real progress. Let's keep this momentum going by targeting your next weakest area.`,
      cta: { label: 'What should I focus on next? →', prompt: 'What should I focus on next to keep improving?' },
      priority: 50,
    });
  } else if (s.avg_percentile >= 70) {
    nudges.push({
      type: 'progress',
      icon: '🏆',
      title: `${s.avg_percentile}% average percentile`,
      message: `You're already in the **top 30%** of test takers. To push into the top 10%, let's fine-tune your strategy and eliminate careless errors.`,
      cta: { label: 'Optimize my strategy →', prompt: 'How can I push my percentile from 70% to 90%?' },
      priority: 45,
    });
  }

  return nudges;
}

/* ── Renderer ────────────────────────────────────────────── */

/**
 * Render a single nudge card as an HTML string.
 * @param {Object} nudge
 * @returns {string}
 */
function renderNudgeCard(nudge) {
  const ctaHtml = nudge.cta
    ? `<button class="nudge-cta" onclick="window.nudgeAction('${escapeAttr(nudge.cta.prompt)}')">${nudge.cta.label}</button>`
    : '';

  return `
    <div class="nudge-card nudge-${nudge.type || 'default'}" data-nudge-type="${nudge.type || ''}">
      <div class="nudge-content">
        <div class="nudge-header">
          <span class="nudge-icon">${nudge.icon || '💡'}</span>
          <span class="nudge-title">${nudge.title}</span>
        </div>
        <div class="nudge-message">${renderNudgeMarkdown(nudge.message)}</div>
        <div class="nudge-actions">
          ${ctaHtml}
          <button class="nudge-dismiss" onclick="this.closest('.nudge-card').remove()">Dismiss</button>
        </div>
      </div>
    </div>`;
}

/**
 * Very lightweight markdown for nudge messages (just bold).
 */
function renderNudgeMarkdown(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function escapeAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
