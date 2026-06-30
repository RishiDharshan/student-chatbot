/**
 * OliveBot — File Upload and Initial Context Controller
 * Handles file upload, parsing, and initial welcome context.
 */

import { detectFormat, validateAndNormalize, formatUsername, getExamName } from './data-adapter.js';

/* ── Public API ──────────────────────────────────────────── */

export function populateSidebar(mockData, stats) {
  const format = mockData._format;
  const s = stats.summary;

  // ── Resolve user/exam info ──────────────────────────────
  let displayName, examName, totalMocks;
  if (format === 'oliveboard') {
    displayName = formatUsername(mockData.username);
    examName    = getExamName(mockData.coursename);
    totalMocks  = (mockData.results || []).length;
  } else {
    displayName = mockData.user.name;
    examName    = mockData.user.target_exam;
    totalMocks  = mockData.metadata.total_mocks_attempted;
  }

  const pctColor = s.avg_percentile >= 80 ? 'green' : s.avg_percentile >= 60 ? 'amber' : 'red';
  const impSign  = s.improvement_points > 0 ? '+' : '';
  const impColor = s.improvement_points > 0 ? 'green' : s.improvement_points < 0 ? 'red' : 'white';

  // ── 1. Stats Bar ────────────────────────────────────────
  const statsBar = document.getElementById('stats-bar');
  if (statsBar) {
    statsBar.style.display = 'block';
    document.getElementById('stats-bar-name').textContent = `${displayName} · ${examName}`;

    const pills = [
      { label: 'Mocks',      val: totalMocks,                               color: 'white' },
      { label: 'Avg Score',  val: s.avg_score,                              color: 'white' },
      { label: 'Avg %ile',   val: `${s.avg_percentile}%`,                   color: pctColor },
      { label: 'Best',       val: s.best_score,                             color: 'green' },
      { label: 'Trend',      val: `${impSign}${s.improvement_points} pts`,  color: impColor },
    ];

    document.getElementById('stats-bar-pills').innerHTML = pills.map(p =>
      `<span class="stats-pill">
         <span class="stats-pill-label">${p.label}</span>
         <span class="stats-pill-val ${p.color}">${p.val}</span>
       </span>`
    ).join('');
  }

  // ── 2. Analytics Sidebar ────────────────────────────────
  const sidebarBody = document.getElementById('sidebar-body');
  if (!sidebarBody) return;

  // Section accuracy bars
  const sa = stats.section_analysis || {};
  const sectionBarsHtml = Object.entries(sa).map(([name, sec]) => {
    const acc = typeof sec.avg_accuracy === 'number' ? sec.avg_accuracy : 0;
    const barColor = acc >= 70 ? 'green' : acc >= 50 ? 'amber' : 'red';
    return `<div class="sb-sec-item">
      <div class="sb-sec-header">
        <span class="sb-sec-name">${name}</span>
        <span class="sb-sec-pct">${acc}%</span>
      </div>
      <div class="sb-bar-track">
        <div class="sb-bar-fill ${barColor}" style="width:${Math.min(acc,100)}%"></div>
      </div>
    </div>`;
  }).join('') || '<span style="font-size:12px;color:var(--text-tertiary)">No section data</span>';

  // Score trend mini bar chart (last 8 mocks max)
  const prog = (stats.score_progression || []).slice(-8);
  const maxScore = prog.length > 0 ? Math.max(...prog.map(p => p.score)) : 1;
  const trendBarsHtml = prog.map((p, i) => {
    const h = Math.max(6, Math.round((p.score / maxScore) * 100));
    const isLatest = i === prog.length - 1;
    return `<div class="sb-trend-bar ${isLatest ? 'latest' : ''}" style="height:${h}%" title="${p.name || 'Mock'}: ${p.score}"></div>`;
  }).join('');

  const firstScore = prog.length > 0 ? prog[0].score : '–';
  const lastScore  = prog.length > 0 ? prog[prog.length - 1].score : '–';

  sidebarBody.innerHTML = `
    <!-- Overview stats -->
    <div class="sb-section">
      <div class="sb-section-title">Overview</div>
      <div class="sb-stat-grid">
        <div class="sb-stat">
          <div class="sb-stat-val white">${totalMocks}</div>
          <div class="sb-stat-lbl">Mocks Taken</div>
        </div>
        <div class="sb-stat">
          <div class="sb-stat-val ${pctColor}">${s.avg_percentile}%</div>
          <div class="sb-stat-lbl">Avg Percentile</div>
        </div>
        <div class="sb-stat">
          <div class="sb-stat-val green">${s.best_score}</div>
          <div class="sb-stat-lbl">Best Score</div>
        </div>
        <div class="sb-stat">
          <div class="sb-stat-val ${impColor}">${impSign}${s.improvement_points}</div>
          <div class="sb-stat-lbl">Pts Gained</div>
        </div>
        <div class="sb-stat">
          <div class="sb-stat-val white">${s.avg_score}</div>
          <div class="sb-stat-lbl">Avg Score</div>
        </div>
        <div class="sb-stat">
          <div class="sb-stat-val red">${s.lowest_score}</div>
          <div class="sb-stat-lbl">Lowest</div>
        </div>
      </div>
    </div>

    <!-- Section accuracy -->
    <div class="sb-section">
      <div class="sb-section-title">Section Accuracy</div>
      <div class="sb-section-row">${sectionBarsHtml}</div>
    </div>

    <!-- Score trend -->
    ${prog.length > 1 ? `
    <div class="sb-section">
      <div class="sb-section-title">Score Trend (Last ${prog.length})</div>
      <div class="sb-trend-row">${trendBarsHtml}</div>
      <div class="sb-trend-label">
        <span class="sb-trend-lbl">${firstScore}</span>
        <span class="sb-trend-lbl">Latest: ${lastScore}</span>
      </div>
    </div>` : ''}
  `;

  // Show upload status tick
  const uploadStatus = document.getElementById('upload-status');
  if (uploadStatus) uploadStatus.style.display = 'block';
}


export function buildWelcomeMessage(mockData, stats) {
  const s = stats.summary;
  const format = mockData._format;

  let firstName, examName, totalMocks;
  if (format === 'oliveboard') {
    firstName = formatUsername(mockData.username).split(' ')[0];
    examName = getExamName(mockData.coursename);
    totalMocks = (mockData.results || []).length;
  } else {
    firstName = mockData.user.name.split(' ')[0];
    examName = mockData.user.target_exam;
    totalMocks = mockData.metadata.total_mocks_attempted;
  }
    
  // Find weak topics
  const ta = stats.topic_analysis || {};
  const weakTopics = Object.entries(ta)
    .filter(([, v]) => v.accuracy < 60)
    .map(([k]) => k);

  const sa = stats.section_analysis || {};
  const weakSections = Object.entries(sa)
    .filter(([, v]) => v.avg_accuracy !== 'N/A' && v.avg_accuracy < 60)
    .map(([k]) => k);
  const allWeak = [...new Set([...weakTopics, ...weakSections])];

  const pctColor = s.avg_percentile >= 70 ? 'green' : s.avg_percentile >= 60 ? 'amber' : 'red';
  const impColor = s.improvement_points > 0 ? 'green' : 'red';
  const impSign = s.improvement_points > 0 ? '+' : '';

  let fourthStat;
  if (format === 'oliveboard') {
    fourthStat = `{"val":"${totalMocks}","label":"Mocks Taken","color":"olive"}`;
  } else {
    const daysLeft = getDaysLeft(mockData.user.exam_date);
    fourthStat = `{"val":"${daysLeft}","label":"Days Left","color":"amber"}`;
  }

  return `Hey **${firstName}!** 👋 I've mapped out your **${totalMocks} mock tests** for **${examName}**.

Here's an instant snapshot of your performance:

- 📈 You've improved by **${impSign}${s.improvement_points} points** comparing recent tests with your early ones.
- 🎯 Your average percentile sits at **${s.avg_percentile}%**.
- 🔴 Focus areas: **${allWeak.length > 0 ? allWeak.slice(0, 5).join(', ') : 'Looking excellent across the board!'}**

What would you like to review? Feel free to ask about your weak areas, request a study roadmap, or compare specific mock tests.`;
}

export function initFileUpload(onFileLoaded) {
  const fileInput = document.getElementById('file-input');
  const uploadZone = document.getElementById('upload-zone');
  
  if (!fileInput || !uploadZone) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) readJsonFile(file, onFileLoaded);
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.opacity = '0.7';
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.opacity = '1';
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.opacity = '1';
    const file = e.dataTransfer.files[0];
    if (file) readJsonFile(file, onFileLoaded);
  });
}

function readJsonFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      const normalized = validateAndNormalize(data);
      if (!normalized) {
        alert(
          'Invalid JSON structure. File must contain either:\n' +
          '• Oliveboard format: "username", "results", "coursename"\n' +
          '• Custom format: "user", "metadata", "mock_tests"'
        );
        return;
      }
      callback(normalized);
    } catch (err) {
      alert('Failed to parse JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function getDaysLeft(examDateStr) {
  if (!examDateStr) return 0;
  return Math.ceil((new Date(examDateStr) - new Date()) / 86400000);
}
