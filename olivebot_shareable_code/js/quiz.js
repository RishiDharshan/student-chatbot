/**
 * OliveBot — Mini Quiz Module
 * Auto-solve popup: shows 10 questions, visually selects answers,
 * computes results, then fires onQuizComplete callback.
 */

import { getMockById, getQuestionsForMock } from './mock-catalog.js';

/* ── State ───────────────────────────────────────────────── */

let completeCallback = null;
let currentQuiz = null;

/* ── Public API ──────────────────────────────────────────── */

export function initQuiz() {
  const closeBtn = document.getElementById('quiz-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeQuiz);
}

export function onQuizComplete(cb) {
  completeCallback = cb;
}

export function startQuiz(mockId) {
  const mock = getMockById(mockId);
  if (!mock) {
    console.warn('[Quiz] Unknown mock ID:', mockId);
    return;
  }

  const questions = getQuestionsForMock(mock, 10);

  currentQuiz = {
    mockId,
    mockName: mock.name,
    difficulty: mock.difficulty,
    questions,
    answers: [],
    currentIndex: 0,
    startTime: Date.now(),
  };

  // Populate header info
  setText('quiz-mock-name', mock.name);
  setText('quiz-difficulty', mock.difficulty);
  setText('quiz-track', mock.exam_track);
  setText('quiz-live-score', 'Score: 0/0');
  resetProgress();

  // Show overlay
  const overlay = document.getElementById('quiz-overlay');
  if (overlay) {
    overlay.classList.remove('quiz-hidden');
    overlay.classList.add('quiz-visible');
  }

  // Start auto-solve after brief pause
  setTimeout(() => solveNext(), 600);
}

/* ── Auto-Solve Loop ─────────────────────────────────────── */

function solveNext() {
  if (!currentQuiz) return;

  const { questions, currentIndex } = currentQuiz;
  const q = questions[currentIndex];
  const total = questions.length;

  // Update progress bar
  const pct = (currentIndex / total) * 100;
  const bar = document.getElementById('quiz-progress-bar');
  if (bar) bar.style.width = `${pct}%`;

  // Update counter
  setText('quiz-q-num', `Question ${currentIndex + 1} of ${total}`);
  setText('quiz-topic-label', `${q.topic} · ${q.subtopic}`);
  setText('quiz-question-text', q.text);

  // Render option buttons
  renderOptions(q.options);

  // After short think delay, auto-select an answer
  setTimeout(() => autoSelectAnswer(q), 200);
}

function autoSelectAnswer(q) {
  if (!currentQuiz) return;

  // 65% base correctness rate (realistic for practice student)
  const isCorrect = Math.random() < 0.65;
  let selectedIdx;

  if (isCorrect) {
    selectedIdx = q.correct;
  } else {
    const wrongOptions = [0, 1, 2, 3].filter(i => i !== q.correct);
    selectedIdx = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
  }

  // Visually highlight selected option
  const optionBtns = document.querySelectorAll('.quiz-option');
  if (optionBtns[selectedIdx]) {
    optionBtns[selectedIdx].classList.add('quiz-option-selected');
  }

  // Record answer
  currentQuiz.answers.push({
    question: q,
    selected: selectedIdx,
    is_correct: selectedIdx === q.correct,
    time_taken_seconds: Math.floor(Math.random() * 55) + 20, // 20–75s realistic
  });

  // Reveal correct/wrong after brief pause
  setTimeout(() => revealResult(q, selectedIdx), 250);
}

function revealResult(q, selectedIdx) {
  if (!currentQuiz) return;

  const optionBtns = document.querySelectorAll('.quiz-option');
  const isCorrect = selectedIdx === q.correct;

  // Show correct in green
  if (optionBtns[q.correct]) {
    optionBtns[q.correct].classList.remove('quiz-option-selected');
    optionBtns[q.correct].classList.add('quiz-option-correct');
  }

  // Show wrong in red if incorrect
  if (!isCorrect && optionBtns[selectedIdx]) {
    optionBtns[selectedIdx].classList.remove('quiz-option-selected');
    optionBtns[selectedIdx].classList.add('quiz-option-wrong');
  }

  // Update live score
  const correct = currentQuiz.answers.filter(a => a.is_correct).length;
  const attempted = currentQuiz.answers.length;
  setText('quiz-live-score', `Score: ${correct}/${attempted}`);

  // Move to next question
  setTimeout(() => {
    currentQuiz.currentIndex++;
    if (currentQuiz.currentIndex < currentQuiz.questions.length) {
      solveNext();
    } else {
      finishQuiz();
    }
  }, 350);
}

function finishQuiz() {
  if (!currentQuiz) return;

  const { answers, mockId, mockName, difficulty, startTime } = currentQuiz;
  const correct = answers.filter(a => a.is_correct).length;
  const wrong = answers.length - correct;
  const timeTaken = Date.now() - startTime;

  // Show 100% progress bar briefly
  const bar = document.getElementById('quiz-progress-bar');
  if (bar) bar.style.width = '100%';
  setText('quiz-q-num', 'Complete!');
  setText('quiz-live-score', `Final: ${correct}/${answers.length}`);

  // Build result object matching mock_test_data.json question format
  const result = {
    mockId,
    mockName,
    difficulty,
    total: answers.length,
    correct,
    wrong,
    timeTaken,
    questions: answers.map(a => ({
      topic: a.question.topic,
      subtopic: a.question.subtopic,
      is_correct: a.is_correct,
      time_taken_seconds: a.time_taken_seconds,
      negative_marks: a.is_correct ? 0 : 0.25,
    })),
  };

  // Close overlay after brief final display
  setTimeout(() => {
    closeQuiz();
    if (completeCallback) completeCallback(result);
  }, 800);
}

/* ── DOM Helpers ─────────────────────────────────────────── */

function renderOptions(options) {
  const container = document.getElementById('quiz-options');
  if (!container) return;

  const letters = ['A', 'B', 'C', 'D'];
  container.innerHTML = options
    .map(
      (opt, i) => `
      <button class="quiz-option" data-index="${i}">
        <span class="quiz-option-letter">${letters[i]}</span>
        <span class="quiz-option-text">${opt}</span>
      </button>`
    )
    .join('');
}

function resetProgress() {
  const bar = document.getElementById('quiz-progress-bar');
  if (bar) bar.style.width = '0%';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function closeQuiz() {
  const overlay = document.getElementById('quiz-overlay');
  if (overlay) {
    overlay.classList.remove('quiz-visible');
    overlay.classList.add('quiz-hidden');
  }
  currentQuiz = null;
}
