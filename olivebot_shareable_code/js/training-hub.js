/**
 * OliveBot — Training Hub Module
 * Retro 8-bit RPG-styled mastery dashboard.
 * Fetches DKT mastery data and renders pixel-art stamina bars.
 * Strictly isolated from the chatbot UI via z-index layering.
 */

/* ── State ───────────────────────────────────────────────── */

let isHubOpen = false;
let hubMasteryData = null;
let hubFlaggedCount = 0;

/* ── Public API ──────────────────────────────────────────── */

/**
 * Initialize the Training Hub — inject DOM, bind events.
 * Call once from app.js after DOMContentLoaded.
 */
export function initTrainingHub() {
  _injectHubDOM();
  _bindEvents();
}

/**
 * Toggle the Training Hub open/closed.
 */
export function toggleHub() {
  const overlay = document.getElementById('training-hub');
  if (!overlay) return;

  isHubOpen = !isHubOpen;
  if (isHubOpen) {
    overlay.classList.add('hub-open');
    _loadMasteryData();
  } else {
    overlay.classList.remove('hub-open');
  }
}

/**
 * Update the badge count on the toggle button.
 * @param {number} count - Number of flagged concepts
 */
export function updateHubBadge(count) {
  hubFlaggedCount = count;
  const badge = document.getElementById('hub-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
  }
}

/**
 * Get flagged count for external modules.
 */
export function getHubFlaggedCount() {
  return hubFlaggedCount;
}

/* ── DOM Injection ───────────────────────────────────────── */

function _injectHubDOM() {
  // Hub toggle button in chat header
  const header = document.querySelector('.chat-header');
  if (header) {
    const btn = document.createElement('button');
    btn.className = 'hub-toggle-btn';
    btn.id = 'hub-toggle-btn';
    btn.innerHTML = `⚔️ Training Hub <span class="hub-badge" id="hub-badge" style="display:none">0</span>`;
    btn.title = 'Open Training Hub';
    // Temporarily hidden per user request
    // header.appendChild(btn);
  }

  // Hub overlay
  const overlay = document.createElement('div');
  overlay.id = 'training-hub';
  overlay.className = 'training-hub-overlay';
  overlay.innerHTML = `
    <div class="hub-header">
      <div class="hub-title">⚔️ TRAINING HUB <span>Memory Fortress</span></div>
      <button class="hub-close-btn" id="hub-close-btn">[ ESC ]</button>
    </div>
    <div id="hub-content">
      <div class="hub-loading">
        <div class="hub-loading-text">SCANNING MEMORY BANKS...</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function _bindEvents() {
  const toggleBtn = document.getElementById('hub-toggle-btn');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleHub);

  const closeBtn = document.getElementById('hub-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', toggleHub);

  // ESC key closes hub
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isHubOpen) toggleHub();
  });
}

/* ── Data Loading ────────────────────────────────────────── */

async function _loadMasteryData() {
  const content = document.getElementById('hub-content');
  if (!content) return;

  content.innerHTML = `<div class="hub-loading"><div class="hub-loading-text">SCANNING MEMORY BANKS...</div></div>`;

  try {
    const resp = await fetch('/api/user/mastery_status');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    hubMasteryData = data.concepts || [];
    hubFlaggedCount = hubMasteryData.filter(c => c.status !== 'mastered').length;
    updateHubBadge(hubFlaggedCount);
    _renderHub(hubMasteryData);
  } catch (err) {
    console.warn('[TrainingHub] API unavailable, using demo data:', err.message);
    // Demo/fallback data for when API isn't running
    _renderHubOffline();
  }
}

/* ── Rendering ───────────────────────────────────────────── */

function _renderHub(concepts) {
  const content = document.getElementById('hub-content');
  if (!content) return;

  const mastered = concepts.filter(c => c.status === 'mastered');
  const decaying = concepts.filter(c => c.status === 'decaying');
  const critical = concepts.filter(c => c.status === 'critical');

  let html = '';

  // Stats summary
  html += `
    <div class="hub-stats-row">
      <div class="hub-stat-box">
        <div class="hub-stat-val stat-green">${mastered.length}</div>
        <div class="hub-stat-label">MASTERED</div>
      </div>
      <div class="hub-stat-box">
        <div class="hub-stat-val stat-yellow">${decaying.length}</div>
        <div class="hub-stat-label">DECAYING</div>
      </div>
      <div class="hub-stat-box">
        <div class="hub-stat-val stat-red">${critical.length}</div>
        <div class="hub-stat-label">CRITICAL</div>
      </div>
      <div class="hub-stat-box">
        <div class="hub-stat-val" style="color:#aaa">${concepts.length}</div>
        <div class="hub-stat-label">TOTAL SKILLS</div>
      </div>
    </div>
  `;

  // Arena CTA (only if there are decaying/critical concepts)
  if (decaying.length + critical.length > 0) {
    const flaggedNames = [...critical, ...decaying].slice(0, 5).map(c => c.name);
    html += `
      <div class="hub-arena">
        <div class="arena-title">⚔️ STAMINA RESTORE ARENA</div>
        <div class="arena-desc">${critical.length + decaying.length} concepts losing retention. Take a booster quiz to restore your memory fortress.</div>
        <div class="arena-concepts">
          ${flaggedNames.map(n => `<span class="arena-concept-tag">${n}</span>`).join('')}
        </div>
        <button class="arena-btn" id="arena-start-btn">RESTORE STAMINA → 5 MIN BOOSTER</button>
      </div>
    `;
  } else {
    html += `
      <div class="hub-all-clear">
        <div class="hub-all-clear-icon">🏰</div>
        <div class="hub-all-clear-text">MEMORY FORTRESS INTACT</div>
      </div>
    `;
  }

  // Mastery bars grouped by status
  html += '<div class="hub-mastery-grid">';

  if (critical.length > 0) {
    html += '<div class="hub-section-title">🔴 CRITICAL — IMMEDIATE REVIEW NEEDED</div>';
    html += critical.map(c => _renderMasteryBar(c)).join('');
  }
  if (decaying.length > 0) {
    html += '<div class="hub-section-title">⚠️ DECAYING — SCHEDULE REVIEW</div>';
    html += decaying.map(c => _renderMasteryBar(c)).join('');
  }
  if (mastered.length > 0) {
    html += '<div class="hub-section-title">✅ MASTERED — STRONG RECALL</div>';
    html += mastered.map(c => _renderMasteryBar(c)).join('');
  }

  html += '</div>';
  content.innerHTML = html;

  // Bind arena button
  const arenaBtn = document.getElementById('arena-start-btn');
  if (arenaBtn) arenaBtn.addEventListener('click', _startBoosterQuiz);

  // Animate bars in
  requestAnimationFrame(() => {
    const bars = content.querySelectorAll('.pixel-bar');
    bars.forEach((bar, i) => {
      bar.style.opacity = '0';
      bar.style.transform = 'translateX(-20px)';
      setTimeout(() => {
        bar.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        bar.style.opacity = '1';
        bar.style.transform = 'translateX(0)';
      }, i * 40);
    });
  });
}

function _renderMasteryBar(concept) {
  const pct = Math.round(concept.probability * 100);
  const filledCount = Math.round(concept.probability * 10);
  const colorClass = concept.status === 'mastered' ? 'green' : concept.status === 'decaying' ? 'yellow' : 'red';

  let segments = '';
  for (let i = 0; i < 10; i++) {
    const filled = i < filledCount ? `filled-${colorClass}` : '';
    segments += `<div class="pixel-seg ${filled}"></div>`;
  }

  return `
    <div class="mastery-row">
      <div class="mastery-name" title="${concept.name}">${concept.name}</div>
      <div class="pixel-bar">${segments}</div>
      <div class="mastery-pct pct-${colorClass}">${pct}%</div>
    </div>
  `;
}

function _renderHubOffline() {
  const content = document.getElementById('hub-content');
  if (!content) return;
  content.innerHTML = `
    <div class="hub-stats-row">
      <div class="hub-stat-box">
        <div class="hub-stat-val" style="color:#555">—</div>
        <div class="hub-stat-label">NO DATA</div>
      </div>
    </div>
    <div class="hub-all-clear">
      <div class="hub-all-clear-icon">📡</div>
      <div class="hub-all-clear-text">UPLOAD DATA TO ACTIVATE</div>
    </div>
  `;
}

/* ── Booster Quiz ────────────────────────────────────────── */

async function _startBoosterQuiz() {
  const btn = document.getElementById('arena-start-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'GENERATING...'; }

  try {
    const resp = await fetch('/api/user/generate_booster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_count: 10 }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    if (data.quiz && data.quiz.questions.length > 0) {
      // Close hub and launch quiz
      if (isHubOpen) toggleHub();
      // Dispatch custom event for app.js to pick up
      window.dispatchEvent(new CustomEvent('booster-quiz', { detail: data.quiz }));
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'NO QUESTIONS AVAILABLE'; }
    }
  } catch (err) {
    console.error('[TrainingHub] Booster quiz error:', err);
    if (btn) { btn.disabled = false; btn.textContent = 'RESTORE STAMINA → 5 MIN BOOSTER'; }
  }
}
