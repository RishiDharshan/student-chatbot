/**
 * OliveBot — Message Renderer
 * Transforms AI-generated text (with special STATS/CHART/ROADMAP tags + markdown)
 * into rich HTML for display in the chat interface.
 */

import { getMockById } from './mock-catalog.js';

/** Escape HTML entities to prevent XSS from AI-generated attributes */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a raw AI response into rich HTML.
 * @param {string} raw - Raw text from LLM (may include special tags and markdown)
 * @returns {string} - Rendered HTML string
 */
export function renderMessage(raw) {
  let html = raw;

  // Use marked.js for standard markdown rendering if available
  // This automatically handles tables, lists, nested bolding, etc far better than regex.
  if (typeof marked !== 'undefined') {
    // Escaping is handled mostly by marked, but we allow HTML since we have custom elements.
    html = marked.parse(raw, { breaks: true });
  }

  // marked.js might wrap our block-level custom tags in <p> tags.
  // We remove the <p> wrappers for our special tags so they render cleanly as block UI components.
  // This prevents layout breakage in CSS.
  html = html.replace(/<p>\s*(<(?:STATS|CHART|ROADMAP|MOCK_LINK)[^>]*\/?(?:>|>\s*<\/[A-Z_]+>))\s*<\/p>/g, '$1');

  // We also handle cases where standard HTML escaping happened to our custom tags by marked.
  html = html.replace(/&lt;((?:STATS|CHART|ROADMAP|MOCK_LINK)[^&]+)&gt;/g, '<$1>');

  // Process custom rich UI blocks
  html = renderStatBlocks(html);
  html = renderChartBlocks(html);
  html = renderRoadmapBlocks(html);
  html = renderMockLinkBlocks(html);

  return html;
}

/* ── STATS Block ─────────────────────────────────────────── */

function renderStatBlocks(html) {
  return html.replace(/<STATS items=('|&#39;|")([^'"]+)\1\s*\/>/g, (_, quote, jsonRaw) => {
    try {
      // Decode escaped quotes inside JSON
      const jsonStr = jsonRaw.replace(/&quot;/g, '"');
      const items = JSON.parse(jsonStr);
      const allowedColors = ['olive', 'green', 'amber', 'red'];
      const cards = items
        .map(
          item => {
            const color = allowedColors.includes(item.color) ? item.color : 'olive';
            return `
          <div class="stat-card">
            <div class="stat-card-val ${color}">${esc(item.val)}</div>
            <div class="stat-card-lbl">${esc(item.label)}</div>
          </div>`;
          }
        )
        .join('');
      return `<div class="stat-grid">${cards}</div>`;
    } catch (e) {
      console.warn("STATS block parse error", e);
      return '';
    }
  });
}

/* ── CHART Block ─────────────────────────────────────────── */

function renderChartBlocks(html) {
  return html.replace(
    /<CHART type=("|&quot;)([^"]+)\1 title=("|&quot;)([^"]+)\3 labels=('|&#39;|")([^']+)\5 data=('|&#39;|")([^']+)\7 colors=('|&#39;|")([^']+)\9\s*\/>/g,
    (_, _q1, type, _q2, title, _q3, labelsRaw, _q4, dataRaw, _q5, colorsRaw) => {
      const chartId = 'chart-' + Math.random().toString(36).slice(2, 10);
      
      const decode = s => s.replace(/&quot;/g, '"');
      
      // Defer chart rendering until the DOM element exists
      setTimeout(() => renderInlineChart(chartId, type, decode(labelsRaw), decode(dataRaw), decode(colorsRaw)), 100);
      return `
        <div class="inline-chart">
          <div class="chart-title">${esc(title)}</div>
          <canvas id="${chartId}"></canvas>
        </div>`;
    }
  );
}

/**
 * Renders a Chart.js chart into a canvas element.
 * Called asynchronously after the DOM element is inserted.
 */
function renderInlineChart(id, type, labelsJson, dataJson, colorsJson) {
  const canvas = document.getElementById(id);
  if (!canvas) return;

  try {
    const labels = JSON.parse(labelsJson);
    const data = JSON.parse(dataJson);
    const colors = JSON.parse(colorsJson);
    const isBar = type === 'bar';

    // eslint-disable-next-line no-undef
    new Chart(canvas.getContext('2d'), {
      type: isBar ? 'bar' : 'line',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors.map(c => c + '33'),
            borderColor: colors,
            borderWidth: 2,
            borderRadius: isBar ? 6 : 0,
            pointBackgroundColor: colors,
            pointRadius: isBar ? 0 : 4,
            tension: 0.4,
            fill: !isBar,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e232e',
            titleColor: '#8db840',
            bodyColor: '#e8ebf2',
            borderColor: 'rgba(141,184,64,0.3)',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: { color: '#9ea5b4', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            ticks: { color: '#9ea5b4', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
        },
      },
    });
  } catch (err) {
    console.error('[OliveBot] Chart render error:', err);
  }
}

/* ── ROADMAP Block ───────────────────────────────────────── */

function renderRoadmapBlocks(html) {
  return html.replace(/<ROADMAP weeks=('|&#39;|")([^'"]+)\1\s*\/>/g, (_, quote, jsonRaw) => {
    try {
      const jsonStr = jsonRaw.replace(/&quot;/g, '"');
      const weeks = JSON.parse(jsonStr);
      const cards = weeks
        .map(w => {
          const priorityClass =
            w.priority === 'critical' ? 'critical' : w.priority === 'attention' ? 'attention' : '';
          const tags = (w.tags || []).map(t => `<span class="week-tag">${esc(t)}</span>`).join('');
          return `
            <div class="week-card ${priorityClass}">
              <div class="week-title">Week ${esc(w.week)}: ${esc(w.theme)}</div>
              ${w.focus ? `<div class="week-focus">${esc(w.focus)}</div>` : ''}
              <div class="week-tags">${tags}</div>
            </div>`;
        })
        .join('');
      return `<div class="roadmap">${cards}</div>`;
    } catch {
      return '';
    }
  });
}

/* ── MOCK_LINK Block ─────────────────────────────────────── */

function renderMockLinkBlocks(html) {
  // Flexible regex: matches <MOCK_LINK ... /> and <MOCK_LINK ... > with attributes in ANY order.
  // It decodes double quotes if marked.js sanitized them.
  return html.replace(
    /<MOCK_LINK\s+([^>]*?)\/?>/g,
    (_, attrsRaw) => {
      // Decode HTML entities if they were escaped by marked
      const attrs = attrsRaw.replace(/&quot;/g, '"').replace(/&#39;/g, "'");

      const get = (key) => {
        const m = attrs.match(new RegExp(`${key}\\s*=\\s*"([^"]*?)"`));
        return m ? m[1] : '';
      };
      
      const id = get('id');
      const name = get('name');
      const difficulty = get('difficulty') || 'Medium';
      const questions = get('questions') || '10';
      const topics = get('topics') || '';
      const reason = get('reason') || 'Recommended based on your performance data';

      // Require a valid catalog ID — reject cards without one or with hallucinated IDs
      if (!id || !getMockById(id)) {
        if (id) console.warn(`[OliveBot] AI recommended unknown mock ID: ${id}`);
        return '';
      }

      const diffClass =
        difficulty === 'Hard' ? 'diff-hard' : difficulty === 'Easy' ? 'diff-easy' : 'diff-medium';
      
      const quizId = id;
      return `
        <div class="mock-rec-card" onclick="window.startQuiz('${esc(quizId)}')">
          <div class="mock-rec-header">
            <div class="mock-rec-name">${esc(name || id)}</div>
            <span class="mock-rec-diff ${diffClass}">${esc(difficulty)}</span>
          </div>
          ${topics ? `<div class="mock-rec-topics">📚 ${esc(topics)}</div>` : ''}
          <div class="mock-rec-reason">💡 ${esc(reason)}</div>
          <div class="mock-rec-footer">
            <span class="mock-rec-count">🎯 ${esc(questions)} questions</span>
            <button class="mock-rec-btn">Start Mini Quiz →</button>
          </div>
        </div>`;
    }
  );
}
