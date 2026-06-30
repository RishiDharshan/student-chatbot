/**
 * OliveBot — Data Adapter
 * Detects whether the uploaded JSON is in the raw Oliveboard export format
 * or the new custom schema, and normalizes both to a unified internal format.
 *
 * Oliveboard raw format has: username, results, coursename, qdata, qsections, timings, etc.
 * Custom schema has:         user, mock_tests, metadata
 *
 * The adapter always outputs the Oliveboard raw format shape because the existing
 * monolithic preCompute() logic was built around it and works correctly.
 */

/* ── Exam Name Mapping ──────────────────────────────────── */

const EXAM_MAP = {
  rbiassistantp: 'RBI Assistant Prelims',
  rbiassistantm: 'RBI Assistant Mains',
  sbipop: 'SBI PO Prelims',
  sbipom: 'SBI PO Mains',
  sbiclerkp: 'SBI Clerk Prelims',
  sbiclerkm: 'SBI Clerk Mains',
  ibpspop: 'IBPS PO Prelims',
  ibpspom: 'IBPS PO Mains',
  ibpsclerkp: 'IBPS Clerk Prelims',
  ibpsclerkm: 'IBPS Clerk Mains',
  rbigradeb: 'RBI Grade B',
  ssccgl: 'SSC CGL',
  sscchsl: 'SSC CHSL',
  cat: 'CAT',
};

export function getExamName(coursename) {
  if (!coursename) return 'Unknown Exam';
  const key = coursename.toLowerCase().replace(/[^a-z]/g, '');
  if (EXAM_MAP[key]) return EXAM_MAP[key];
  // Fallback: format the raw code as title
  return coursename
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[\s_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function formatUsername(username) {
  if (!username) return 'Student';
  return username
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\d+/g, '')
    .trim() || 'Student';
}

/* ── Format Detection ───────────────────────────────────── */

/**
 * Determine whether the JSON is Oliveboard raw or custom schema.
 * @param {Object} data
 * @returns {'oliveboard'|'custom'|null}
 */
export function detectFormat(data) {
  if (data.username && data.results && data.coursename) return 'oliveboard';
  if (data.user && data.mock_tests && data.metadata) return 'custom';
  return null;
}

/**
 * Validate and return a normalized data object.
 * For Oliveboard format: pass through as-is (all modules will use it directly).
 * For custom format: pass through as-is.
 * Returns null if invalid.
 * @param {Object} data
 * @returns {Object|null}
 */
export function validateAndNormalize(data) {
  const format = detectFormat(data);
  if (!format) return null;
  // Tag the format for downstream modules
  data._format = format;
  return data;
}
