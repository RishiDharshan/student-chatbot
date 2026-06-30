/**
 * OliveBot — Stats Engine
 * Pre-computes all analytics from mock test data.
 * Supports both:
 *   1. Oliveboard raw format (username, results, coursename, qdata, etc.)
 *   2. Custom schema (user, mock_tests, metadata with per-question objects)
 */

/**
 * @param {Object} data - Raw data in either format (tagged with data._format)
 * @returns {Object} Pre-computed statistics object
 */
export function preComputeStats(data) {
  if (data._format === 'oliveboard') {
    return preComputeOliveboard(data);
  }
  return preComputeCustom(data);
}

/* ══════════════════════════════════════════════════════════
   OLIVEBOARD FORMAT — ported from the monolithic preCompute()
   ══════════════════════════════════════════════════════════ */

function preComputeOliveboard(data) {
  const results = data.results || [];
  const sectionNames = data.sectionnames || {};
  const qdata = data.qdata || {};
  const allQAttempts = data.allquestion_attempts || {};
  const topicsData = data.alltopics_data || {};

  // Score progression (sorted by test taken date)
  const sortedResults = [...results].sort(
    (a, b) => new Date(a.testtakenat) - new Date(b.testtakenat)
  );

  const scoreProg = sortedResults.map(r => ({
    id: r.testid,
    score: r.total,
    percentile: parseFloat(r.percentile.toFixed(1)),
    date: r.testtakenat ? r.testtakenat.slice(0, 10) : '',
    name: r.testname,
    accuracy: r.overall_accuracy,
    attempt_rate: r.overall_attempt_rate,
    total_correct: r.totalc,
    total_wrong: r.totalw,
    sectional_scores: r.sectionalscores,
    sectional_accuracy: r.sectional_accuracy,
    sectional_percentiles: r.sectionalpercentiles,
  }));

  const scores = scoreProg.map(s => s.score);
  const pcts = scoreProg.map(s => s.percentile);
  const avgScore = scores.length > 0
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : '0';
  const avgPct = pcts.length > 0
    ? (pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1)
    : '0';
  const improvement = scores.length >= 2
    ? (scores[scores.length - 1] - scores[0]).toFixed(0)
    : '0';
  const last3 = scores.slice(-3);
  const first3 = scores.slice(0, 3);
  const rollingTrend =
    last3.length > 0 && first3.length > 0
      ? (
          last3.reduce((a, b) => a + b, 0) / last3.length -
          first3.reduce((a, b) => a + b, 0) / first3.length
        ).toFixed(1)
      : '0';

  // Sectional analysis across all mocks
  const sectionStats = {};
  for (const r of sortedResults) {
    if (r.sectionalscores) {
      for (const [sec, score] of Object.entries(r.sectionalscores)) {
        if (!sectionStats[sec])
          sectionStats[sec] = { scores: [], accuracies: [], percentiles: [], wrong: [] };
        sectionStats[sec].scores.push(score);
        if (r.sectional_accuracy && r.sectional_accuracy[sec] !== undefined)
          sectionStats[sec].accuracies.push(r.sectional_accuracy[sec]);
        if (r.sectionalpercentiles && r.sectionalpercentiles[sec] !== undefined)
          sectionStats[sec].percentiles.push(r.sectionalpercentiles[sec]);
        if (r.sectionalrw && r.sectionalrw[sec])
          sectionStats[sec].wrong.push(r.sectionalrw[sec].wrong || 0);
      }
    }
  }

  const sectionSummary = {};
  for (const [sec, s] of Object.entries(sectionStats)) {
    const secName = sectionNames[sec] || sec.toUpperCase();
    const avgSc = (s.scores.reduce((a, b) => a + b, 0) / s.scores.length).toFixed(1);
    const avgAcc =
      s.accuracies.length > 0
        ? (s.accuracies.reduce((a, b) => a + b, 0) / s.accuracies.length).toFixed(1)
        : 'N/A';
    const avgPctl =
      s.percentiles.length > 0
        ? (s.percentiles.reduce((a, b) => a + b, 0) / s.percentiles.length).toFixed(1)
        : 'N/A';
    const trend =
      s.scores.length >= 2 ? (s.scores[s.scores.length - 1] - s.scores[0]).toFixed(1) : '0';
    sectionSummary[secName] = {
      code: sec,
      avg_score: parseFloat(avgSc),
      avg_accuracy: avgAcc === 'N/A' ? avgAcc : parseFloat(avgAcc),
      avg_percentile: avgPctl === 'N/A' ? avgPctl : parseFloat(avgPctl),
      trend: parseFloat(trend),
      total_wrong: s.wrong.reduce((a, b) => a + b, 0),
      classification:
        avgAcc !== 'N/A'
          ? parseFloat(avgAcc) >= 70
            ? 'STRENGTH'
            : parseFloat(avgAcc) >= 50
              ? 'AVERAGE'
              : parseFloat(avgAcc) >= 35
                ? 'WEAK'
                : 'CRITICAL_WEAK'
          : 'UNKNOWN',
    };
  }

  // Topic analysis from alltopics_data
  const topicSummary = {};
  for (const [topic, td] of Object.entries(topicsData)) {
    const acc =
      td.total_questions > 0
        ? parseFloat(((td.correct / td.total_questions) * 100).toFixed(1))
        : 0;
    const avgTime = td.avg_time || 0;
    topicSummary[topic] = {
      accuracy: acc,
      avg_time_sec: parseFloat(avgTime),
      total_questions: td.total_questions,
      attempted: td.attempted,
      correct: td.correct,
      section: sectionNames[td.section] || td.section,
      section_code: td.section,
      ideal_time_sec: td.ideal_time || 0,
      classification:
        acc >= 70 ? 'STRENGTH' : acc >= 50 ? 'AVERAGE' : acc >= 35 ? 'WEAK' : 'CRITICAL_WEAK',
    };
  }

  // If alltopics_data is empty, build topic analysis from qdata + results
  if (Object.keys(topicSummary).length === 0 && Object.keys(qdata).length > 0) {
    buildTopicAnalysisFromQdata(qdata, sortedResults, sectionNames, topicSummary);
  }

  // Per-mock sectional breakdown
  const perMockSections = sortedResults.map(r => {
    const secs = {};
    if (r.sectionalscores) {
      for (const [sec, score] of Object.entries(r.sectionalscores)) {
        const secName = sectionNames[sec] || sec.toUpperCase();
        secs[secName] = {
          score,
          accuracy: r.sectional_accuracy ? r.sectional_accuracy[sec] : null,
          percentile: r.sectionalpercentiles
            ? parseFloat(r.sectionalpercentiles[sec].toFixed(1))
            : null,
        };
      }
    }
    return { test_id: r.testid, test_name: r.testname, sections: secs };
  });

  // Error analysis
  let totalQsAnalyzed = 0;
  let totalWrong = 0;
  let conceptualErrors = 0;
  let carelessErrors = 0;
  let totalNegMarks = 0;
  const errorTopicFreq = {};
  const topicTimes = {};

  for (const [qid, qa] of Object.entries(allQAttempts)) {
    if (!qa.attempted) continue;
    totalQsAnalyzed++;
    const qInfo = qdata[qid];
    const topicName = qa.tags || (qInfo ? qInfo[2] : 'Unknown');
    const timeTaken = qa.time_taken || 0;

    if (!topicTimes[topicName]) topicTimes[topicName] = [];
    topicTimes[topicName].push(timeTaken);

    if (!qa.correct) {
      totalWrong++;
      totalNegMarks += 0.25;
      errorTopicFreq[topicName] = (errorTopicFreq[topicName] || 0) + 1;
      if (timeTaken > 180) conceptualErrors++;
      if (timeTaken < 60) carelessErrors++;
    }
  }

  // If allquestion_attempts is empty, build basic error analysis from results
  if (totalQsAnalyzed === 0) {
    for (const r of sortedResults) {
      totalWrong += r.totalw || 0;
      totalQsAnalyzed += (r.totalc || 0) + (r.totalw || 0);
    }
    totalNegMarks = totalWrong * 0.25;
  }

  const topErrorTopics = Object.entries(errorTopicFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, errors]) => ({ topic, errors }));

  const slowTopics = Object.entries(topicTimes)
    .map(([topic, times]) => ({
      topic,
      avg_time: parseFloat(
        (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0)
      ),
    }))
    .filter(s => s.avg_time > 150)
    .sort((a, b) => b.avg_time - a.avg_time);

  const fastWrongRate =
    totalQsAnalyzed > 0
      ? parseFloat((carelessErrors / totalQsAnalyzed * 100).toFixed(1))
      : 0;

  // Date range
  const dates = sortedResults.map(r => r.testtakenat).filter(Boolean).sort();
  const fromDate = dates.length > 0 ? dates[0].slice(0, 10) : 'N/A';
  const toDate = dates.length > 0 ? dates[dates.length - 1].slice(0, 10) : 'N/A';

  return {
    score_progression: scoreProg,
    summary: {
      avg_score: parseFloat(avgScore),
      avg_percentile: parseFloat(avgPct),
      best_score: scores.length > 0 ? Math.max(...scores) : 0,
      lowest_score: scores.length > 0 ? Math.min(...scores) : 0,
      improvement_points: parseInt(improvement),
      rolling_trend_vs_first3: parseFloat(rollingTrend),
      total_mocks: results.length,
      score_variance:
        scores.length > 0
          ? parseFloat((Math.max(...scores) - Math.min(...scores)).toFixed(0))
          : 0,
    },
    section_analysis: sectionSummary,
    topic_analysis: topicSummary,
    per_mock_section_breakdown: perMockSections,
    error_analysis: {
      total_wrong: totalWrong,
      total_negative_marks: parseFloat(totalNegMarks.toFixed(1)),
      conceptual_errors: conceptualErrors,
      careless_errors: carelessErrors,
      error_rate_pct:
        totalQsAnalyzed > 0
          ? parseFloat((totalWrong / totalQsAnalyzed * 100).toFixed(1))
          : 0,
      fast_wrong_rate_pct: fastWrongRate,
      top_error_topics: topErrorTopics,
    },
    slow_topics: slowTopics,
    total_questions_analyzed: totalQsAnalyzed,
    date_range: { from: fromDate, to: toDate },
  };
}

/* ── Build topic analysis from qdata when alltopics_data is missing ── */

function buildTopicAnalysisFromQdata(qdata, sortedResults, sectionNames, topicSummary) {
  // qdata format: { "1001": [correctOption, "sectionCode", "TopicName"], ... }
  // results[].testresponse: { "1001": { q: "1001", t: [...], o: "userAnswer" } }
  const topicStats = {};

  for (const r of sortedResults) {
    const response = r.testresponse || {};
    for (const [qid, qInfo] of Object.entries(qdata)) {
      if (!qInfo || qInfo.length < 3) continue;
      const [correctOption, sectionCode, topicName] = qInfo;
      const userResponse = response[qid];

      if (!topicStats[topicName]) {
        topicStats[topicName] = { correct: 0, total: 0, section: sectionCode };
      }
      // Only count if the question belongs to this test
      if (userResponse) {
        topicStats[topicName].total++;
        const userAnswer = userResponse.o;
        if (userAnswer && String(userAnswer) === String(correctOption)) {
          topicStats[topicName].correct++;
        }
      }
    }
  }

  for (const [topic, td] of Object.entries(topicStats)) {
    if (td.total === 0) continue;
    const acc = parseFloat(((td.correct / td.total) * 100).toFixed(1));
    topicSummary[topic] = {
      accuracy: acc,
      avg_time_sec: 0,
      total_questions: td.total,
      attempted: td.total,
      correct: td.correct,
      section: sectionNames[td.section] || td.section,
      section_code: td.section,
      ideal_time_sec: 0,
      classification:
        acc >= 70 ? 'STRENGTH' : acc >= 50 ? 'AVERAGE' : acc >= 35 ? 'WEAK' : 'CRITICAL_WEAK',
    };
  }
}

/* ══════════════════════════════════════════════════════════
   CUSTOM FORMAT — the original modular stats engine
   ══════════════════════════════════════════════════════════ */

function preComputeCustom(data) {
  const mocks = data.mock_tests;
  const allQuestions = mocks.flatMap(mock =>
    mock.questions.map(q => ({ ...q, mock_id: mock.mock_id, mock_date: mock.attempted_on }))
  );

  const scoreProgression = mocks.map(m => ({
    id: m.mock_id,
    score: m.total_score,
    percentile: m.percentile,
    date: m.attempted_on.slice(0, 10),
    name: m.mock_name,
  }));

  const scores = scoreProgression.map(s => s.score);
  const percentiles = scoreProgression.map(s => s.percentile);
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const last3 = scores.slice(-3);
  const first3 = scores.slice(0, 3);

  const summary = {
    avg_score: round(avg(scores)),
    avg_percentile: round(avg(percentiles)),
    best_score: Math.max(...scores),
    lowest_score: Math.min(...scores),
    improvement_points: scores[scores.length - 1] - scores[0],
    rolling_trend_vs_first3: round(avg(last3) - avg(first3)),
    total_mocks: scores.length,
    score_variance: Math.max(...scores) - Math.min(...scores),
  };

  // Topic analysis
  const topics = {};
  for (const q of allQuestions) {
    if (!topics[q.topic]) {
      topics[q.topic] = { correct: 0, total: 0, times: [], subtopics: {} };
    }
    const topic = topics[q.topic];
    topic.total++;
    if (q.is_correct) topic.correct++;
    topic.times.push(q.time_taken_seconds);

    if (!topic.subtopics[q.subtopic]) {
      topic.subtopics[q.subtopic] = { correct: 0, total: 0, times: [] };
    }
    const sub = topic.subtopics[q.subtopic];
    sub.total++;
    if (q.is_correct) sub.correct++;
    sub.times.push(q.time_taken_seconds);
  }

  const topicAnalysis = {};
  for (const [name, d] of Object.entries(topics)) {
    const accuracy = round((d.correct / d.total) * 100);
    const subtopics = {};
    for (const [subName, subData] of Object.entries(d.subtopics)) {
      const subAcc = round((subData.correct / subData.total) * 100);
      subtopics[subName] = {
        accuracy: subAcc,
        avg_time_sec: Math.round(avg(subData.times)),
        attempts: subData.total,
        classification: classify(subAcc),
      };
    }
    topicAnalysis[name] = {
      accuracy,
      avg_time_sec: Math.round(avg(d.times)),
      total_attempts: d.total,
      subtopics,
    };
  }

  // Per-mock topic breakdown
  const perMockTopics = mocks.map(mock => {
    const byTopic = {};
    for (const q of mock.questions) {
      if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0 };
      byTopic[q.topic].total++;
      if (q.is_correct) byTopic[q.topic].correct++;
    }
    const t = {};
    for (const [tp, v] of Object.entries(byTopic)) {
      t[tp] = round((v.correct / v.total) * 100);
    }
    return { mock_id: mock.mock_id, topics: t };
  });

  // Error analysis
  const wrong = allQuestions.filter(q => !q.is_correct);
  const totalNeg = wrong.reduce((sum, q) => sum + Math.abs(q.negative_marks), 0);
  const conceptual = wrong.filter(q => q.time_taken_seconds > 180).length;
  const careless = wrong.filter(q => q.time_taken_seconds < 60).length;
  const freq = {};
  for (const q of wrong) {
    freq[q.subtopic] = (freq[q.subtopic] || 0) + 1;
  }
  const topErrors = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([subtopic, errors]) => ({ subtopic, errors }));

  // Time analysis
  const bySubtopic = {};
  for (const q of allQuestions) {
    if (!bySubtopic[q.subtopic]) bySubtopic[q.subtopic] = [];
    bySubtopic[q.subtopic].push(q.time_taken_seconds);
  }
  const slowSubtopics = Object.entries(bySubtopic)
    .map(([subtopic, times]) => ({ subtopic, avg_time: Math.round(avg(times)) }))
    .filter(s => s.avg_time > 150)
    .sort((a, b) => b.avg_time - a.avg_time);

  return {
    score_progression: scoreProgression,
    summary,
    topic_analysis: topicAnalysis,
    per_mock_topic_breakdown: perMockTopics,
    error_analysis: {
      total_wrong: wrong.length,
      total_negative_marks: round(totalNeg),
      conceptual_errors: conceptual,
      careless_errors: careless,
      error_rate_pct: round((wrong.length / allQuestions.length) * 100),
      fast_wrong_rate_pct: round((careless / allQuestions.length) * 100),
      top_error_subtopics: topErrors,
    },
    slow_subtopics: slowSubtopics,
    total_questions_analyzed: allQuestions.length,
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function round(n) {
  return parseFloat(n.toFixed(1));
}

function classify(accuracy) {
  if (accuracy >= 70) return 'STRENGTH';
  if (accuracy >= 50) return 'AVERAGE';
  if (accuracy >= 35) return 'WEAK';
  return 'CRITICAL_WEAK';
}
