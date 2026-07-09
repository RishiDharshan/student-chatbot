/**
 * OliveBot — Application Entry Point
 * Wires together all modules: sidebar, chat, stats engine, prompt builder, quiz, and nudge engine.
 * Handles global event listeners and intent filtering.
 */

import { preComputeStats } from './stats-engine.js';
import { buildSystemPrompt } from './prompt-builder.js';
import { sendChatMessage, sendSilentMessage, resetConversation, displayBotMessage, displayRejection, displayUserBubble, isBusy } from './chat.js';
import { initFileUpload, populateSidebar, buildWelcomeMessage } from './sidebar.js';
import { validateAndNormalize, getExamName } from './data-adapter.js';
import { initQuiz, startQuiz, onQuizComplete } from './quiz.js';
import { generateNudges, renderNudgeCards, scheduleIdleNudge, cancelIdleNudge } from './nudge-engine.js';
import { initTrainingHub, toggleHub, updateHubBadge } from './training-hub.js';
import {
  getGoals, saveGoals, hasGoals,
  getNextUpcomingGoal, getExpiredGoals, getActiveGoals,
  buildCountdownNudge, buildExpiredMessage, buildGoalAskMessage,
  autoDetectExam, lookupExamDate, buildDateConfirmation, daysUntil,
} from './goal-manager.js';

/* ── State ───────────────────────────────────────────────── */

let mockData = null;
let preComputedStats = null;

/* ── Goal State ──────────────────────────────────────────── */

/** Tracks whether we're waiting for the user to confirm an exam date */
let _goalPendingConfirm = null;  // { name, estimated_date, cycle, track } or null

/* ── Out-of-Scope Detector ───────────────────────────────── */

const OUT_OF_SCOPE_PATTERNS = [
  /\b(code|programming|python|javascript|sql|html|css|react|java\b)/i,
  /\b(recipe|cook|food|restaurant|movie|music|song|game|sport|ipl|cricket match)\b/i,
  /\b(weather|forecast|temperature)\b/i,
  /\b(joke|funny|meme)\b/i,
  /\b(relationship|girlfriend|boyfriend|family issue)\b/i,
  /\b(college assignment|homework|thesis|dissertation)\b/i,
  /\b(stock market|crypto|bitcoin|investment advice)\b/i,
];

const EXAM_KEYWORDS = /(exam|mock|score|study|preparation|percentile|syllabus|banking|ssc|upsc|mba|cat|ibps|sbi|rbi)/i;

function isOutOfScope(message) {
  return OUT_OF_SCOPE_PATTERNS.some(p => p.test(message)) && !EXAM_KEYWORDS.test(message);
}

/* ── Send Handler ────────────────────────────────────────── */

async function handleSend() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || isBusy()) return;

  // Cancel idle nudge on any user interaction
  cancelIdleNudge();

  if (!mockData) {
    displayBotMessage('⚠️ Please upload your mock test JSON file first using the upload button above.');
    return;
  }

  // ── Goal confirmation interceptor ──────────────────────
  if (_goalPendingConfirm) {
    const handled = await _handleGoalResponse(text);
    if (handled) {
      input.value = '';
      input.style.height = 'auto';
      return;
    }
    // If not handled, fall through to normal chat
  }

  if (isOutOfScope(text)) {
    displayUserBubble(text);
    input.value = '';
    displayRejection(
      "I'm your exam performance coach — I can only help with your preparation, scores, study plans, and exam strategy. What would you like to know about your performance?"
    );
    return;
  }

  input.value = '';
  input.style.height = 'auto';

  try {
    const systemPrompt = buildSystemPrompt(mockData, preComputedStats);
    await sendChatMessage(text, systemPrompt);
  } catch (err) {
    console.error('[OliveBot] Send error:', err);
    displayBotMessage(`⚠️ Something went wrong: ${err.message}. Please try refreshing the page.`);
  }
}

/* ── Nudge Action Handler ────────────────────────────────── */

function handleNudgeAction(promptText) {
  if (!mockData) {
    displayBotMessage('⚠️ Please upload your mock test JSON first.');
    return;
  }
  cancelIdleNudge();
  document.getElementById('chat-input').value = promptText;
  handleSend();
}

/* ── Quick Prompt Handler ────────────────────────────────── */

function handleQuickPrompt(text) {
  if (!mockData) {
    displayBotMessage('⚠️ Please upload your mock test JSON first.');
    return;
  }
  cancelIdleNudge();
  document.getElementById('chat-input').value = text;
  handleSend();
}

/* ── Data Load & Sync Handler ────────────────────────────── */

let currentDataHash = null;

function processData(data) {
  try {
    const dataHash = JSON.stringify(data);
    if (currentDataHash === dataHash) return; // No changes
    
    const wasEmpty = !mockData;
    mockData = data;
    currentDataHash = dataHash;
    preComputedStats = preComputeStats(data);
    populateSidebar(data, preComputedStats);
    
    if (wasEmpty) {
      document.getElementById('welcome-screen').style.display = 'none';
      resetConversation();

      // Display the welcome message
      const welcomeMsg = buildWelcomeMessage(data, preComputedStats);
      displayBotMessage(welcomeMsg);

      // ── Goal Tracker: check goals on load ─────────────────
      _checkGoalsOnLoad(data, preComputedStats);

      // Generate and display nudge cards
      const nudges = generateNudges(data, preComputedStats);
      if (nudges.length > 0) {
        const nudgeHtml = renderNudgeCards(nudges, 2);
        const container = document.getElementById('messages');
        const nudgeWrapper = document.createElement('div');
        nudgeWrapper.className = 'nudge-wrapper';
        nudgeWrapper.style.display = 'flex';
        nudgeWrapper.style.flexDirection = 'column';
        nudgeWrapper.style.alignItems = 'center';
        nudgeWrapper.style.width = '100%';
        nudgeWrapper.innerHTML = nudgeHtml;
        container.appendChild(nudgeWrapper);
        container.scrollTop = container.scrollHeight;
      }

      // Schedule idle nudge
      scheduleIdleNudge((cardHtml) => {
        const container = document.getElementById('messages');
        const idleWrapper = document.createElement('div');
        idleWrapper.className = 'nudge-wrapper';
        idleWrapper.style.display = 'flex';
        idleWrapper.style.flexDirection = 'column';
        idleWrapper.style.alignItems = 'center';
        idleWrapper.style.width = '100%';
        idleWrapper.innerHTML = cardHtml;
        container.appendChild(idleWrapper);
        container.scrollTop = container.scrollHeight;
      }, 45);
    } else {
      console.log('[OliveBot] Background data sync complete.');
    }

    // ── DKT: Upload data to backend for mastery tracking ──
    _uploadToDKT(data);

  } catch (err) {
    console.error('[OliveBot] Data processing error:', err);
    if (!currentDataHash) {
      displayBotMessage(`❌ Error loading data: ${err.message}. Please check your JSON format.`);
    }
  }
}

function handleFileLoaded(data) {
  processData(data);
}


/** POST user data to DKT backend and update Training Hub badge */
async function _uploadToDKT(data) {
  try {
    const resp = await fetch('/api/upload_user_data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (resp.ok) {
      console.log('[DKT] User data uploaded to backend');
      // Fetch flagged count for badge
      const flagResp = await fetch('/api/user/flagged_concepts');
      if (flagResp.ok) {
        const flagData = await flagResp.json();
        updateHubBadge((flagData.flagged || []).length);
      }
    }
  } catch (err) {
    // DKT backend not available — silently degrade
    console.warn('[DKT] Backend not available:', err.message);
  }
}

/* ── Goal Tracker Helpers ────────────────────────────────── */

/**
 * Called once on initial data load. Checks for existing goals,
 * shows countdown / expired / ask messages accordingly.
 */
async function _checkGoalsOnLoad(data, stats) {
  const goals = getGoals(data);

  if (goals.length > 0) {
    // Attach to in-memory data for prompt builder
    data.goal_exams = goals;

    // Check for expired goals
    const expired = getExpiredGoals(goals);
    for (const g of expired) {
      displayBotMessage(buildExpiredMessage(g));
    }

    // Check for upcoming goals — show countdown for the nearest one
    const nextGoal = getNextUpcomingGoal(goals);
    if (nextGoal) {
      const nudgeMsg = buildCountdownNudge(nextGoal, stats, data);
      displayBotMessage(nudgeMsg);
      _showCountdownBanner(nextGoal);

      // Auto-trigger a daily study plan from LLM
      setTimeout(() => _triggerStudyPlan(nextGoal, 'daily'), 500);
    }

    // If all goals have expired, remove them and ask for new
    if (expired.length > 0 && !nextGoal) {
      // Keep only non-expired goals (should be empty here)
      const active = getActiveGoals(goals);
      saveGoals(data, active);
    }
  } else {
    // No goals — ask the user conversationally
    const examName = data.coursename ? getExamName(data.coursename) : 'your target exam';
    displayBotMessage(buildGoalAskMessage(examName));

    // Auto-detect and prepare confirmation
    const detected = await autoDetectExam(data);
    if (detected) {
      _goalPendingConfirm = detected;
      // Show confirmation after a small delay so the ask message renders first
      setTimeout(() => {
        displayBotMessage(buildDateConfirmation(detected));
      }, 800);
    }
  }
}

/**
 * Handle the user's response when we're waiting for goal confirmation.
 * Returns true if the response was handled (consumed), false to pass through.
 */
async function _handleGoalResponse(text) {
  const lower = text.toLowerCase().trim();

  // Affirmative responses
  if (/^(yes|yeah|yep|sure|confirm|ok|okay|y|set it|go ahead|do it)$/i.test(lower)) {
    displayUserBubble(text);
    const goal = {
      name: _goalPendingConfirm.name,
      exam_key: _goalPendingConfirm.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      date: _goalPendingConfirm.estimated_date,
      confirmed: true,
      set_at: new Date().toISOString(),
    };
    const goals = getGoals(mockData);
    // Avoid duplicates
    const existing = goals.find(g => g.name === goal.name);
    if (!existing) {
      goals.push(goal);
    }
    saveGoals(mockData, goals);
    _goalPendingConfirm = null;

    _showCountdownBanner(goal);

    // Auto-trigger full study schedule from LLM
    await _triggerStudyPlan(goal, 'full');
    return true;
  }

  // User wants to set a different exam
  if (/different|change|no|nope|not this|another|wrong/i.test(lower)) {
    displayUserBubble(text);
    _goalPendingConfirm = null;
    displayBotMessage('No problem! Tell me the exam name you\'re targeting (e.g., "IBPS PO Prelims", "SBI Clerk", "CAT") and I\'ll look up the date for you.');
    return true;
  }

  // User typed a date (e.g., "October 15, 2026" or "2026-10-15" or "15/10/2026")
  const dateMatch = _parseDate(lower);
  if (dateMatch) {
    displayUserBubble(text);
    const name = _goalPendingConfirm ? _goalPendingConfirm.name : 'Exam';
    const goal = {
      name,
      exam_key: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      date: dateMatch,
      confirmed: true,
      set_at: new Date().toISOString(),
    };
    const goals = getGoals(mockData);
    goals.push(goal);
    saveGoals(mockData, goals);
    _goalPendingConfirm = null;

    const days = daysUntil(goal.date);
    displayBotMessage(`✅ **Goal set!** ${goal.name} on **${new Date(dateMatch).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}** — **${days} days** to go. I'll track your progress against this deadline! 🎯`);
    _showCountdownBanner(goal);
    return true;
  }

  // User typed an exam name — look it up
  const examEntry = await lookupExamDate(text);
  if (examEntry) {
    _goalPendingConfirm = examEntry;
    displayUserBubble(text);
    displayBotMessage(buildDateConfirmation(examEntry));
    return true;
  }

  // Couldn't parse — let it fall through to normal chat
  return false;
}

/**
 * Send a silent message to the LLM to auto-generate a study plan.
 * @param {Object} goal  - { name, date }
 * @param {'full'|'daily'} mode - 'full' = first-time schedule, 'daily' = returning user nudge
 */
async function _triggerStudyPlan(goal, mode) {
  if (!mockData || !preComputedStats) return;

  const days = daysUntil(goal.date);
  const s = preComputedStats.summary || {};
  const sa = preComputedStats.section_analysis || {};

  // Build section performance summary for the prompt
  const sectionLines = Object.entries(sa)
    .map(([name, sec]) => `  - ${name}: ${sec.avg_accuracy}% accuracy, ${sec.avg_percentile}% percentile`)
    .join('\n');

  let silentPrompt;

  if (mode === 'full') {
    silentPrompt = `The student just confirmed their exam goal: ${goal.name} on ${goal.date} (${days} days from now).

Here is their current performance:
- Total mocks: ${s.total_mocks || 0}
- Average score: ${s.avg_score || 'N/A'}
- Average percentile: ${s.avg_percentile || 'N/A'}%
- Best score: ${s.best_score || 'N/A'}
- Score trend: ${s.improvement_points > 0 ? 'improving (+' + s.improvement_points + ' pts)' : s.improvement_points < 0 ? 'declining (' + s.improvement_points + ' pts)' : 'stable'}
Section breakdown:
${sectionLines || '  No section data available'}

Generate a COMPLETE personalized study schedule working backward from the exam date. You MUST:

1. **Open with motivation**: Acknowledge their commitment to setting a goal. Reference a specific strength from their data (e.g., "Your Numerical Ability at 93% is already exam-ready — that's your anchor"). Do NOT use generic phrases like "Great job!".

2. **Phase-based roadmap**: Divide the ${days} remaining days into 3-4 phases using the ROADMAP tag:
   - Each phase should target specific weak areas from their data
   - Phases should be progressively more intensive as the exam approaches
   - The final phase (last 7-10 days) should be revision + full mocks only

3. **Weekly breakdown**: For the current week, give a day-by-day plan with:
   - Specific topics to cover (from their weak areas)
   - How many practice questions per topic
   - Time allocation per section

4. **Praise what deserves praise**: If any section is above 85%, explicitly acknowledge it: "Your [section] is a genuine strength — you can afford to reduce time here and redirect it to [weak section]."

5. **Be honest about gaps**: If any section is below 60%, say so directly. Don't soften it. Give a concrete recovery plan.

6. **End with today's one task**: One specific, actionable thing they should do RIGHT NOW.

Use ROADMAP and CHART tags for visual output. Be the coach who knows their data inside out.`;
  } else {
    // Daily mode — shorter, focused on today
    silentPrompt = `The student is returning today. Their exam goal is ${goal.name} on ${goal.date} — **${days} days remaining**.

Their current stats:
- Mocks completed: ${s.total_mocks || 0}
- Avg score: ${s.avg_score || 'N/A'}, Best: ${s.best_score || 'N/A'}
- Avg percentile: ${s.avg_percentile || 'N/A'}%
- Trend: ${s.improvement_points > 0 ? 'improving' : s.improvement_points < 0 ? 'declining' : 'stable'}
Sections:
${sectionLines || '  No data'}

Generate a FOCUSED daily coaching message. You MUST:

1. **Open with context**: "With ${days} days to ${goal.name}..." — make the countdown feel real but not anxiety-inducing.

2. **Acknowledge progress**: If their trend is positive, say so with a specific number: "Your last 3 mocks show a clear upward trend — you've improved ${Math.abs(s.improvement_points || 0)} points since your first mock."

3. **Today's focus plan**: Give exactly 2-3 concrete actions for TODAY:
   - What section to practice (choose their weakest)
   - How many questions (specific number: "20 questions", not "some questions")
   - Time limit ("Set a 30-minute timer")

4. **Motivational nudge**: End with something that acknowledges their effort without being cheesy. Examples:
   - "The fact that you're here today, with ${days} days left, puts you ahead of most aspirants."
   - "Your consistency is the hardest part — and you've shown up."
   
Do NOT generate a full roadmap. Keep it to 150 words max. Be warm but direct.`;
  }

  try {
    const systemPrompt = buildSystemPrompt(mockData, preComputedStats);
    await sendSilentMessage(silentPrompt, systemPrompt);
  } catch (err) {
    console.error('[GoalTracker] Study plan generation failed:', err);
  }
}

/**
 * Show the slim countdown banner at the top of the chat area.
 */
function _showCountdownBanner(goal) {
  // Remove existing banner if any
  const existing = document.getElementById('goal-countdown-banner');
  if (existing) existing.remove();

  const days = daysUntil(goal.date);
  if (days <= 0) return;

  const banner = document.createElement('div');
  banner.id = 'goal-countdown-banner';
  banner.className = 'goal-banner';

  let urgencyClass = '';
  if (days <= 7) urgencyClass = 'goal-banner--critical';
  else if (days <= 30) urgencyClass = 'goal-banner--warning';

  banner.classList.add(urgencyClass || 'goal-banner--normal');
  banner.innerHTML = `📅 <strong>${goal.name}</strong> — <span class="goal-days">${days} day${days !== 1 ? 's' : ''}</span> left`;

  const messagesContainer = document.getElementById('messages');
  messagesContainer.parentElement.insertBefore(banner, messagesContainer);
}

/**
 * Try to parse a date from user text.
 * Supports: YYYY-MM-DD, DD/MM/YYYY, "October 15 2026", "15 Oct 2026"
 * Returns ISO date string or null.
 */
function _parseDate(text) {
  // ISO format
  const isoMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (!isNaN(d)) return isoMatch[0];
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const d = new Date(`${slashMatch[3]}-${slashMatch[2].padStart(2,'0')}-${slashMatch[1].padStart(2,'0')}`);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }

  // Natural language: "October 15, 2026" or "15 October 2026"
  try {
    const d = new Date(text);
    if (!isNaN(d) && d.getFullYear() > 2020) return d.toISOString().split('T')[0];
  } catch { /* ignore */ }

  return null;
}



/* ── Quiz Complete Handler ───────────────────────────────── */

async function handleQuizComplete(result) {
  if (!result || !mockData || !preComputedStats) return;

  try {
    const { mockName, difficulty, total, correct, wrong, questions, timeTaken } = result;
    if (!total || !questions || questions.length === 0) return;

    const accuracy = Math.round((correct / total) * 100);
    const negMarks = parseFloat((wrong * 0.25).toFixed(2));
    const netScore = parseFloat((correct - wrong * 0.25).toFixed(1));
    const totalSec = Math.round(timeTaken / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = String(totalSec % 60).padStart(2, '0');

    // Build per-topic breakdown with historical comparison
    const topicMap = {};
    for (const q of questions) {
      if (!topicMap[q.topic]) topicMap[q.topic] = { correct: 0, total: 0 };
      topicMap[q.topic].total++;
      if (q.is_correct) topicMap[q.topic].correct++;
    }

    const ta = preComputedStats.topic_analysis || {};
    const sa = preComputedStats.section_analysis || {};
    const topicBreakdown = Object.entries(topicMap).map(([topic, d]) => {
      const quizAcc = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
      let histAcc = null;
      if (ta[topic] && typeof ta[topic].accuracy === 'number') {
        histAcc = Math.round(ta[topic].accuracy);
      } else if (sa[topic] && typeof sa[topic].avg_accuracy === 'number') {
        histAcc = Math.round(sa[topic].avg_accuracy);
      }
      return { topic, quizCorrect: d.correct, quizTotal: d.total, quizAccuracy: quizAcc, historicalAccuracy: histAcc };
    });

    const s = preComputedStats.summary || {};

    const quizData = {
      mockName,
      difficulty,
      total,
      correct,
      wrong,
      accuracy,
      negMarks,
      netScore,
      timeFormatted: `${min}:${sec}`,
      topicBreakdown,
      overallProfile: {
        totalMocks: s.total_mocks || 0,
        avgScore: s.avg_score || 0,
        avgPercentile: s.avg_percentile || 0,
        improvementPoints: s.improvement_points || 0,
      },
    };

    const quizSummary =
`I just completed the mini mock "${mockName}" (${difficulty}, ${total} questions).

Here is my quiz data in structured form:
${JSON.stringify(quizData)}

Analyze this quiz result alongside my overall mock history (in your pre-computed stats). Generate your full post-quiz analysis using STATS, CHART, and MOCK_LINK tags as specified in your POST-QUIZ ANALYSIS OUTPUT instructions.`;

    const systemPrompt = buildSystemPrompt(mockData, preComputedStats);
    await sendSilentMessage(quizSummary, systemPrompt);
    
    // ── DKT: Append results to Delta Log ──
    try {
      const payload = {
        questions: questions.map(q => ({
          topic: q.topic,
          is_correct: q.is_correct ? 1 : 0,
          time_taken: q.time_taken || 30.0
        }))
      };
      
      const resp = await fetch('/api/user/update_after_quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (resp.ok) {
        console.log('[DKT] Quiz results appended to Delta Log');
        // If Training Hub is open, refresh it
        const hubOverlay = document.getElementById('training-hub');
        if (hubOverlay && hubOverlay.classList.contains('hub-open')) {
          // Re-trigger load to refresh bars
          toggleTrainingHub(); // close
          setTimeout(() => toggleTrainingHub(), 50); // open
        }
      }
    } catch (err) {
      console.error('[DKT] Failed to update delta log:', err);
    }
    
  } catch (err) {
    console.error('[OliveBot] Quiz complete handler error:', err);
    displayBotMessage('⚠️ Something went wrong analyzing your quiz results. Please try again.');
  }
}

/* ── Initialisation ──────────────────────────────────────── */

function init() {
  initFileUpload(handleFileLoaded, (msg) => displayBotMessage(msg));


  document.getElementById('send-btn').addEventListener('click', handleSend);

  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 140) + 'px';
    // Cancel idle nudge when user starts typing
    cancelIdleNudge();
  });

  // Quiz system
  initQuiz();
  onQuizComplete(handleQuizComplete);

  // Training Hub
  initTrainingHub();

  // Listen for booster quiz events from Training Hub
  window.addEventListener('booster-quiz', (e) => {
    const quiz = e.detail;
    if (quiz && quiz.questions) {
      displayBotMessage(`⚔️ **Booster Quiz Starting:** ${quiz.name} — ${quiz.question_count} questions targeting: ${quiz.target_concepts.join(', ')}`);
    }
  });

  // Expose globals for HTML onclick attributes
  window.quickPrompt = handleQuickPrompt;
  window.startQuiz = startQuiz;
  window.nudgeAction = handleNudgeAction;
  window.toggleTrainingHub = toggleHub;
  window.__testUpload = handleFileLoaded;
}

document.addEventListener('DOMContentLoaded', init);

// [DEMO LAYER] Register inject hook at module level — available immediately when module loads.
// Closures over mockData, currentDataHash, and processData from this module's scope.
// Safe to delete alongside demo-inject.js and css/demo-inject.css
window.__injectMockResult = function (resultObj) {
  if (!mockData) return false; // Signal failure — main data not yet loaded
  const updatedData = JSON.parse(JSON.stringify(mockData));
  if (!Array.isArray(updatedData.results)) updatedData.results = [];
  updatedData.results.push(resultObj);
  if (updatedData.testids && Array.isArray(updatedData.testids)) {
    if (resultObj.testid && !updatedData.testids.includes(resultObj.testid)) {
      updatedData.testids.push(resultObj.testid);
    }
  }
  currentDataHash = null; // force re-process
  processData(updatedData);
  console.log('[DemoPanel] Injected:', resultObj.testname || resultObj.testid);
  return true;
};
