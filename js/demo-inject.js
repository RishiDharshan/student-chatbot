/**
 * ============================================================
 * DEMO INJECT PANEL — Isolated Layer (Safe to Delete)
 * 
 * This file is completely self-contained. It:
 *  - Injects the floating trigger button + modal into the DOM
 *  - Handles .json file upload/drag-and-drop
 *  - Parses and previews a single mock test result object
 *  - Calls window.__injectMockResult(result) to append it live
 *
 * To remove: delete this file, css/demo-inject.css, and the
 * two lines in index.html that reference them.
 * ============================================================
 */

(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────── */
  let parsedResult = null;        // The parsed mock result object
  let currentStep  = 1;           // 1 = upload, 2 = preview, 3 = success
  const injectedLog = [];         // History of injected mocks this session

  /* ── HTML Template ─────────────────────────────────────── */

  function buildHTML() {
    return `
<!-- ══ DEMO INJECT TRIGGER ══ -->
<button id="demo-inject-trigger" title="TL Demo: Inject Mock Test Data">
  <span class="di-icon">🧪</span>
  Input additional user data
  <span class="di-badge">TL</span>
</button>

<!-- ══ DEMO INJECT MODAL ══ -->
<div id="demo-inject-backdrop" role="dialog" aria-modal="true" aria-label="TL Demo: Inject Mock Test">
  <div class="di-modal">

    <!-- Header -->
    <div class="di-header">
      <div class="di-header-left">
        <div class="di-title">
          <span class="di-title-icon">⚡</span>
          Dynamic Memory Injection
        </div>
        <div class="di-subtitle">Append a new mock test result to live session data</div>
      </div>
      <button class="di-close-btn" id="di-close-btn" title="Close">✕</button>
    </div>

    <!-- Body -->
    <div class="di-body" id="di-body">

      <!-- Step Indicator -->
      <div class="di-steps" id="di-steps">
        <div class="di-step active" id="di-step-1">
          <div class="di-step-num">1</div>
          <div class="di-step-label">Upload JSON</div>
        </div>
        <div class="di-step-line"></div>
        <div class="di-step" id="di-step-2">
          <div class="di-step-num">2</div>
          <div class="di-step-label">Preview</div>
        </div>
        <div class="di-step-line"></div>
        <div class="di-step" id="di-step-3">
          <div class="di-step-num">3</div>
          <div class="di-step-label">Injected</div>
        </div>
      </div>

      <!-- Format Info -->
      <div class="di-format-info">
        <span class="di-format-info-icon">ℹ️</span>
        <div class="di-format-info-text">
          Upload a single mock test result JSON matching the
          <strong>example_io format</strong> — with fields like
          <strong>testname</strong>, <strong>overall_accuracy</strong>,
          <strong>percentile</strong>, <strong>sectionalscores</strong>,
          and <strong>testresponse</strong>. It will be appended live
          to the current session's <strong>results[]</strong> array.
        </div>
      </div>

      <!-- Upload Zone -->
      <div class="di-upload-zone" id="di-upload-zone">
        <input type="file" id="di-file-input" accept=".json" aria-label="Upload mock test JSON" />
        <div class="di-upload-icon">📂</div>
        <div class="di-upload-title">Drop your .json file here</div>
        <div class="di-upload-hint">or click to browse — single mock result object</div>
      </div>

      <!-- Error Banner -->
      <div class="di-error" id="di-error"></div>
      <!-- Warning Banner -->
      <div class="di-warning" id="di-warning"></div>

      <!-- Preview Card (hidden until file parsed) -->
      <div class="di-preview" id="di-preview">
        <div class="di-preview-header">
          <div class="di-preview-title" id="di-prev-name">—</div>
          <div class="di-preview-badge" id="di-prev-badge">VALID</div>
        </div>
        <div class="di-stats-grid">
          <div class="di-stat-box">
            <div class="di-stat-value" id="di-prev-score">—</div>
            <div class="di-stat-label">Total Score</div>
          </div>
          <div class="di-stat-box">
            <div class="di-stat-value" id="di-prev-pct">—</div>
            <div class="di-stat-label">Percentile</div>
          </div>
          <div class="di-stat-box">
            <div class="di-stat-value" id="di-prev-acc">—</div>
            <div class="di-stat-label">Accuracy %</div>
          </div>
        </div>
        <div class="di-sectional-row" id="di-prev-sections"></div>
      </div>

      <!-- Success State -->
      <div class="di-success" id="di-success">
        <div class="di-success-icon">✅</div>
        <div class="di-success-title">Mock Injected Successfully!</div>
        <div class="di-success-sub">The chatbot now has access to this test in its memory. Ask it anything about it.</div>
        <div class="di-injected-count" id="di-injected-count">1 mock added this session</div>
      </div>

      <!-- History Log -->
      <div class="di-history" id="di-history">
        <div class="di-history-header">Injected This Session</div>
        <div id="di-history-list"></div>
      </div>

    </div>

    <!-- Footer -->
    <div class="di-footer" id="di-footer">
      <button class="di-btn di-btn-ghost" id="di-cancel-btn">Cancel</button>
      <button class="di-btn di-btn-primary" id="di-inject-btn" disabled>
        ⚡ Inject into Memory
      </button>
    </div>

  </div>
</div>`;
  }

  /* ── DOM Injection ─────────────────────────────────────── */

  function mountPanel() {
    const container = document.createElement('div');
    container.id = 'demo-inject-root';
    container.innerHTML = buildHTML();
    document.body.appendChild(container);
  }

  /* ── Step Management ───────────────────────────────────── */

  function setStep(n) {
    currentStep = n;
    [1, 2, 3].forEach(i => {
      const el = document.getElementById('di-step-' + i);
      if (!el) return;
      el.classList.remove('active', 'done');
      if (i < n) el.classList.add('done');
      if (i === n) el.classList.add('active');
    });
  }

  /* ── Parse & Validate JSON ─────────────────────────────── */

  function parseAndValidate(raw) {
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      throw new Error('Invalid JSON — ' + e.message);
    }

    // Must have testname or testid
    if (!obj.testname && !obj.testid) {
      throw new Error('Missing required field: testname or testid');
    }

    // Warn if missing optional key fields
    const warnings = [];
    if (obj.percentile == null)      warnings.push('percentile');
    if (obj.overall_accuracy == null) warnings.push('overall_accuracy');
    if (!obj.testresponse)            warnings.push('testresponse');
    if (!obj.sectionalscores)         warnings.push('sectionalscores');

    return { obj, warnings };
  }

  /* ── Populate Preview Card ─────────────────────────────── */

  function showPreview(obj, warnings) {
    document.getElementById('di-prev-name').textContent =
      obj.testname || ('Test ID: ' + obj.testid);

    document.getElementById('di-prev-score').textContent =
      obj.total != null ? obj.total : (obj.sectionalscores
        ? Object.values(obj.sectionalscores).reduce((a,b) => a+b, 0).toFixed(2)
        : '—');

    document.getElementById('di-prev-pct').textContent =
      obj.percentile != null ? obj.percentile.toFixed(1) + '%' : '—';

    document.getElementById('di-prev-acc').textContent =
      obj.overall_accuracy != null ? obj.overall_accuracy.toFixed(1) + '%' : '—';

    // Sectional scores
    const sectRow = document.getElementById('di-prev-sections');
    sectRow.innerHTML = '';
    const ss = obj.sectionalscores || obj.sectional_accuracy || {};
    const sectionLabels = { qa: 'Num Ability', el: 'English', lr: 'Reasoning' };
    Object.entries(ss).slice(0, 3).forEach(([key, val]) => {
      const chip = document.createElement('div');
      chip.className = 'di-section-chip';
      chip.innerHTML = `
        <div class="di-section-chip-label">${sectionLabels[key] || key.toUpperCase()}</div>
        <div class="di-section-chip-val">${typeof val === 'number' ? val.toFixed(1) : val}</div>
      `;
      sectRow.appendChild(chip);
    });

    document.getElementById('di-preview').classList.add('visible');

    // Show warnings
    const warnEl = document.getElementById('di-warning');
    if (warnings.length > 0) {
      warnEl.textContent = '⚠️ Missing optional fields: ' + warnings.join(', ') + '. The mock will still be injected.';
      warnEl.classList.add('visible');
    } else {
      warnEl.classList.remove('visible');
    }

    document.getElementById('di-inject-btn').disabled = false;
    setStep(2);
  }

  /* ── File Read Handler ─────────────────────────────────── */

  function handleFile(file) {
    if (!file || !file.name.endsWith('.json')) {
      showError('Please upload a valid .json file.');
      return;
    }

    // Reset
    clearError();
    document.getElementById('di-preview').classList.remove('visible');
    document.getElementById('di-inject-btn').disabled = true;
    document.getElementById('di-success').classList.remove('visible');

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const { obj, warnings } = parseAndValidate(e.target.result);
        parsedResult = obj;
        showPreview(obj, warnings);
      } catch (err) {
        showError('❌ ' + err.message);
        parsedResult = null;
      }
    };
    reader.readAsText(file);
  }

  /* ── Error Helpers ─────────────────────────────────────── */

  function showError(msg) {
    const el = document.getElementById('di-error');
    el.textContent = msg;
    el.classList.add('visible');
  }

  function clearError() {
    const el = document.getElementById('di-error');
    el.textContent = '';
    el.classList.remove('visible');
  }

  /* ── Inject Into Memory ─────────────────────────────────── */

  function doInject() {
    if (!parsedResult) return;

    // Check that the main app exposes the hook
    if (typeof window.__injectMockResult !== 'function') {
      showError('❌ Main app hook not found. Is the page loaded with data?');
      return;
    }

    const success = window.__injectMockResult(parsedResult);

    if (success === false) {
      showError('❌ Injection failed — data not yet loaded. Upload the main user data file first.');
      return;
    }

    // Log to session history
    injectedLog.push({
      name: parsedResult.testname || ('Test ID: ' + parsedResult.testid),
      pct: parsedResult.percentile,
      acc: parsedResult.overall_accuracy,
    });

    // Update success UI
    document.getElementById('di-injected-count').textContent =
      injectedLog.length + ' mock' + (injectedLog.length > 1 ? 's' : '') + ' added this session';

    document.getElementById('di-preview').classList.remove('visible');
    document.getElementById('di-warning').classList.remove('visible');
    document.getElementById('di-success').classList.add('visible');

    // Swap footer buttons
    document.getElementById('di-inject-btn').style.display = 'none';
    document.getElementById('di-cancel-btn').textContent = 'Close';

    // Update history log
    updateHistoryLog();
    setStep(3);

    // Reset for next upload
    parsedResult = null;
    document.getElementById('di-file-input').value = '';
  }

  /* ── History Log ────────────────────────────────────────── */

  function updateHistoryLog() {
    const hist = document.getElementById('di-history');
    const list = document.getElementById('di-history-list');

    list.innerHTML = injectedLog.map(entry => `
      <div class="di-history-item">
        <div style="display:flex;align-items:center;">
          <div class="di-history-dot"></div>
          <div class="di-history-name">${entry.name}</div>
        </div>
        <div class="di-history-meta">
          ${entry.pct != null ? entry.pct.toFixed(1) + '%ile' : '—'}
          · ${entry.acc != null ? entry.acc.toFixed(1) + '% acc' : '—'}
        </div>
      </div>
    `).join('');

    hist.classList.add('has-items');
  }

  /* ── Modal Open / Close ─────────────────────────────────── */

  function openModal() {
    document.getElementById('demo-inject-backdrop').classList.add('di-open');
  }

  function closeModal() {
    document.getElementById('demo-inject-backdrop').classList.remove('di-open');
    // Short delay then reset to upload state if on step 3
    setTimeout(() => {
      if (currentStep === 3) resetToUpload();
    }, 300);
  }

  function resetToUpload() {
    parsedResult = null;
    clearError();
    document.getElementById('di-warning').classList.remove('visible');
    document.getElementById('di-preview').classList.remove('visible');
    document.getElementById('di-success').classList.remove('visible');
    document.getElementById('di-inject-btn').style.display = '';
    document.getElementById('di-inject-btn').disabled = true;
    document.getElementById('di-cancel-btn').textContent = 'Cancel';
    document.getElementById('di-file-input').value = '';
    setStep(1);
    // Keep history log visible
    if (injectedLog.length > 0) updateHistoryLog();
  }

  /* ── Event Wiring ───────────────────────────────────────── */

  function wireEvents() {
    // Trigger button
    document.getElementById('demo-inject-trigger')
      .addEventListener('click', openModal);

    // Close / cancel
    document.getElementById('di-close-btn')
      .addEventListener('click', closeModal);
    document.getElementById('di-cancel-btn')
      .addEventListener('click', closeModal);

    // Click outside modal
    document.getElementById('demo-inject-backdrop')
      .addEventListener('click', function(e) {
        if (e.target === this) closeModal();
      });

    // File input change
    document.getElementById('di-file-input')
      .addEventListener('change', function(e) {
        handleFile(e.target.files[0]);
      });

    // Drag and drop on upload zone
    const zone = document.getElementById('di-upload-zone');
    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.classList.add('dragover');
    });
    zone.addEventListener('dragleave', function() {
      this.classList.remove('dragover');
    });
    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('dragover');
      handleFile(e.dataTransfer.files[0]);
    });

    // Inject button
    document.getElementById('di-inject-btn')
      .addEventListener('click', doInject);

    // Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  /* ── Init ───────────────────────────────────────────────── */

  function init() {
    mountPanel();
    wireEvents();
    console.log('[DemoPanel] Loaded. Call window.__injectMockResult(obj) to inject.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
