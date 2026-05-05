/**
 * OliveBot — Application Entry Point
 * Wires together all modules: sidebar, chat, stats engine, prompt builder, quiz, and nudge engine.
 * Handles global event listeners and intent filtering.
 */

import { preComputeStats } from './stats-engine.js';
import { buildSystemPrompt } from './prompt-builder.js';
import { sendChatMessage, sendSilentMessage, resetConversation, displayBotMessage, displayRejection, displayUserBubble, isBusy } from './chat.js';
import { initFileUpload, populateSidebar, buildWelcomeMessage } from './sidebar.js';
import { initQuiz, startQuiz, onQuizComplete } from './quiz.js';
import { generateNudges, renderNudgeCards, scheduleIdleNudge, cancelIdleNudge } from './nudge-engine.js';

/* ── State ───────────────────────────────────────────────── */

let mockData = null;
let preComputedStats = null;

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

  const systemPrompt = buildSystemPrompt(mockData, preComputedStats);
  await sendChatMessage(text, systemPrompt);
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

/* ── File Load Handler ───────────────────────────────────── */

function handleFileLoaded(data) {
  try {
    mockData = data;
    preComputedStats = preComputeStats(data);
    populateSidebar(data, preComputedStats);
    document.getElementById('welcome-screen').style.display = 'none';
    resetConversation();

    // Display the welcome message
    const welcomeMsg = buildWelcomeMessage(data, preComputedStats);
    displayBotMessage(welcomeMsg);

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
      // Scroll to show nudge cards
      container.scrollTop = container.scrollHeight;
    }

    // Schedule idle nudge in case the user doesn't interact
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

  } catch (err) {
    console.error('[OliveBot] File load error:', err);
    displayBotMessage(`❌ Error loading data: ${err.message}. Please check your JSON file matches the expected format.`);
  }
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

  // Expose globals for HTML onclick attributes
  window.quickPrompt = handleQuickPrompt;
  window.startQuiz = startQuiz;
  window.nudgeAction = handleNudgeAction;
  window.__testUpload = handleFileLoaded;
}

document.addEventListener('DOMContentLoaded', init);
