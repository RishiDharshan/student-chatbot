/**
 * OliveBot — File Upload and Initial Context Controller
 * Handles file upload, parsing, and initial welcome context.
 */

import { detectFormat, validateAndNormalize, formatUsername, getExamName } from './data-adapter.js';

/* ── Public API ──────────────────────────────────────────── */

export function populateSidebar(mockData, stats) {
  // Previously populated sidebar UI. Now we only need to hide the welcome screen 
  // since the main interface is distraction-free.
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
