/**
 * OliveBot — Mock Test Catalog
 * 20 mock tests across Banking, SSC, MBA, UPSC tracks.
 * Each mock has a question bank used by the auto-solve quiz popup.
 */

/* ── Mock Catalog ────────────────────────────────────────── */

export const MOCK_CATALOG = [
  // ── Banking ──────────────────────────────────────────────
  {
    id: 'ibps_po_pre_1',
    name: 'IBPS PO Prelims – Mock 1',
    exam_track: 'Banking',
    difficulty: 'Medium',
    questions_count: 10,
    topics: ['Data Interpretation', 'Seating Arrangement', 'Reading Comprehension'],
    description: 'Classic IBPS PO pattern — DI caselets, linear arrangement, editorial RC',
  },
  {
    id: 'ibps_po_pre_2',
    name: 'IBPS PO Prelims – Mock 2',
    exam_track: 'Banking',
    difficulty: 'Hard',
    questions_count: 10,
    topics: ['Number Series', 'Puzzles', 'Error Spotting'],
    description: 'Advanced IBPS PO — complex number patterns, floor puzzles, grammar errors',
  },
  {
    id: 'ibps_clerk_pre_1',
    name: 'IBPS Clerk Prelims – Mock 1',
    exam_track: 'Banking',
    difficulty: 'Easy',
    questions_count: 10,
    topics: ['Simplification', 'Syllogism', 'Cloze Test'],
    description: 'Clerk foundation — BODMAS, basic deductions, vocabulary in context',
  },
  {
    id: 'ibps_clerk_pre_2',
    name: 'IBPS Clerk Prelims – Mock 2',
    exam_track: 'Banking',
    difficulty: 'Medium',
    questions_count: 10,
    topics: ['Data Interpretation', 'Blood Relations', 'Fill in the Blanks'],
    description: 'Clerk mid-level — tabular DI, family trees, vocabulary fill-in',
  },
  {
    id: 'sbi_po_pre_1',
    name: 'SBI PO Prelims – Mock 1',
    exam_track: 'Banking',
    difficulty: 'Medium',
    questions_count: 10,
    topics: ['Quadratic Equations', 'Seating Arrangement', 'Reading Comprehension'],
    description: 'SBI PO pattern — quant + circular arrangement + editorial passage RC',
  },
  {
    id: 'sbi_po_pre_2',
    name: 'SBI PO Prelims – Mock 2',
    exam_track: 'Banking',
    difficulty: 'Hard',
    questions_count: 10,
    topics: ['Data Interpretation', 'Puzzles', 'Para-jumbles'],
    description: 'SBI PO advanced — hard DI sets, scheduling puzzles, sentence reordering',
  },
  {
    id: 'sbi_clerk_pre_1',
    name: 'SBI Clerk Prelims – Mock 1',
    exam_track: 'Banking',
    difficulty: 'Easy',
    questions_count: 10,
    topics: ['Number Series', 'Inequality', 'Error Spotting'],
    description: 'SBI Clerk starter — number patterns, coded inequalities, spot-the-error',
  },
  {
    id: 'rbi_grade_b_1',
    name: 'RBI Grade B Phase 1 – Mock 1',
    exam_track: 'Banking',
    difficulty: 'Hard',
    questions_count: 10,
    topics: ['Data Interpretation', 'Puzzles', 'Banking Awareness'],
    description: 'RBI Grade B — high-difficulty DI, complex puzzles, monetary policy GA',
  },
  {
    id: 'rbi_asst_pre_1',
    name: 'RBI Assistant Prelims – Mock 1',
    exam_track: 'Banking',
    difficulty: 'Medium',
    questions_count: 10,
    topics: ['Simplification', 'Seating Arrangement', 'Reading Comprehension'],
    description: 'RBI Assistant — balanced prelims across all three sections',
  },
  {
    id: 'nabard_grade_a_1',
    name: 'NABARD Grade A – Mock 1',
    exam_track: 'Banking',
    difficulty: 'Hard',
    questions_count: 10,
    topics: ['Data Interpretation', 'Syllogism', 'Banking Awareness'],
    description: 'NABARD focus — agricultural economy DI, deductive reasoning, rural finance GA',
  },

  // ── SSC ───────────────────────────────────────────────────
  {
    id: 'ssc_cgl_t1_1',
    name: 'SSC CGL Tier 1 – Mock 1',
    exam_track: 'SSC',
    difficulty: 'Medium',
    questions_count: 10,
    topics: ['Number Series', 'Logical Reasoning', 'General Awareness'],
    description: 'SSC CGL Tier 1 pattern — quant + reasoning + static GK',
  },
  {
    id: 'ssc_cgl_t1_2',
    name: 'SSC CGL Tier 1 – Mock 2',
    exam_track: 'SSC',
    difficulty: 'Hard',
    questions_count: 10,
    topics: ['Data Interpretation', 'Syllogism', 'General Awareness'],
    description: 'Advanced Tier 1 — DI-based quant, complex syllogism, current affairs GK',
  },
  {
    id: 'ssc_chsl_1',
    name: 'SSC CHSL – Mock 1',
    exam_track: 'SSC',
    difficulty: 'Easy',
    questions_count: 10,
    topics: ['Simplification', 'Logical Reasoning', 'General Awareness'],
    description: 'CHSL foundation — good for building speed and accuracy',
  },
  {
    id: 'rrb_ntpc_1',
    name: 'RRB NTPC – Mock 1',
    exam_track: 'SSC',
    difficulty: 'Medium',
    questions_count: 10,
    topics: ['Number Series', 'Blood Relations', 'General Awareness'],
    description: 'Railway NTPC pattern — number sequences, family puzzles, railway GK',
  },

  // ── MBA ───────────────────────────────────────────────────
  {
    id: 'cat_full_1',
    name: 'CAT Full Mock – Set 1',
    exam_track: 'MBA',
    difficulty: 'Hard',
    questions_count: 10,
    topics: ['Verbal Ability', 'Logical Reasoning', 'Quantitative'],
    description: 'CAT simulation — VARC RC passages, DILR sets, advanced QA',
  },
  {
    id: 'cat_varc_1',
    name: 'CAT VARC Practice – Set 1',
    exam_track: 'MBA',
    difficulty: 'Hard',
    questions_count: 10,
    topics: ['Verbal Ability', 'Reading Comprehension'],
    description: 'Focused VARC — 2 RC passages + Para-jumbles + sentence summary',
  },
  {
    id: 'xat_mock_1',
    name: 'XAT Simulation – Mock 1',
    exam_track: 'MBA',
    difficulty: 'Hard',
    questions_count: 10,
    topics: ['Verbal Ability', 'Logical Reasoning', 'Quantitative'],
    description: 'XAT pattern — decision making, DM + Verbal + Quant integrated',
  },

  // ── UPSC ──────────────────────────────────────────────────
  {
    id: 'upsc_gs1_1',
    name: 'UPSC Prelims GS Paper 1 – Mock 1',
    exam_track: 'UPSC',
    difficulty: 'Hard',
    questions_count: 10,
    topics: ['General Awareness', 'Logical Reasoning'],
    description: 'UPSC GS1 — History, Geography, Polity, Economy, Science',
  },
  {
    id: 'upsc_csat_1',
    name: 'UPSC CSAT (Paper 2) – Mock 1',
    exam_track: 'UPSC',
    difficulty: 'Medium',
    questions_count: 10,
    topics: ['Logical Reasoning', 'Reading Comprehension', 'Quantitative'],
    description: 'CSAT qualifying paper — comprehension, analytical ability, basic numerics',
  },
  {
    id: 'state_psc_1',
    name: 'State PSC Prelims – Mock 1',
    exam_track: 'UPSC',
    difficulty: 'Medium',
    questions_count: 10,
    topics: ['General Awareness', 'Logical Reasoning'],
    description: 'State PSC GS + reasoning — good warm-up before UPSC mocks',
  },
];

/* ── Question Bank ───────────────────────────────────────── */

export const QUESTION_BANK = {

  'Data Interpretation': [
    { id: 'di_01', text: 'The table shows monthly sales (₹ lakhs): Jan=42, Feb=38, Mar=55, Apr=61. What is the average monthly sales?', options: ['₹46 L', '₹49 L', '₹52 L', '₹44 L'], correct: 1, subtopic: 'Tabular DI', time_estimate: 90 },
    { id: 'di_02', text: 'Bar chart: Company A profit — Q1: 120cr, Q2: 150cr, Q3: 95cr, Q4: 180cr. Which quarter showed highest growth over previous?', options: ['Q1', 'Q2', 'Q3', 'Q4'], correct: 3, subtopic: 'Bar Chart', time_estimate: 75 },
    { id: 'di_03', text: 'Pie chart: Total expenditure ₹8 lakh. Education sector = 25%. What is education expenditure?', options: ['₹1.5 L', '₹2 L', '₹2.5 L', '₹1.8 L'], correct: 1, subtopic: 'Pie Chart', time_estimate: 60 },
    { id: 'di_04', text: 'Line graph: Stock price on Mon=200, Tue=220, Wed=195, Thu=240, Fri=210. On which day was the price lowest?', options: ['Monday', 'Tuesday', 'Wednesday', 'Friday'], correct: 2, subtopic: 'Line Graph', time_estimate: 60 },
    { id: 'di_05', text: 'Table: 5 students scored 72, 85, 68, 91, 78. What is the percentage of students scoring above 75?', options: ['40%', '60%', '50%', '80%'], correct: 1, subtopic: 'Tabular DI', time_estimate: 75 },
    { id: 'di_06', text: 'Bank A deposits grew from ₹500cr to ₹650cr over 3 years. What is the % increase?', options: ['25%', '28%', '30%', '22%'], correct: 2, subtopic: 'Bar Chart', time_estimate: 90 },
  ],

  'Number Series': [
    { id: 'ns_01', text: 'Find the missing term: 2, 6, 12, 20, 30, ?', options: ['40', '42', '44', '38'], correct: 1, subtopic: 'Difference Series', time_estimate: 45 },
    { id: 'ns_02', text: 'Find the missing term: 3, 9, 27, 81, ?', options: ['162', '243', '256', '324'], correct: 1, subtopic: 'Geometric Series', time_estimate: 30 },
    { id: 'ns_03', text: 'Find the missing term: 1, 4, 9, 16, 25, ?', options: ['30', '36', '49', '32'], correct: 1, subtopic: 'Square Series', time_estimate: 30 },
    { id: 'ns_04', text: 'Find the wrong number: 5, 10, 20, 45, 80, 160', options: ['10', '20', '45', '80'], correct: 2, subtopic: 'Wrong Term', time_estimate: 60 },
    { id: 'ns_05', text: 'Find the missing term: 100, 98, 94, 88, 80, ?', options: ['72', '70', '68', '74'], correct: 1, subtopic: 'Difference Series', time_estimate: 45 },
    { id: 'ns_06', text: 'Find the missing term: 2, 3, 5, 8, 13, 21, ?', options: ['33', '34', '32', '36'], correct: 1, subtopic: 'Fibonacci', time_estimate: 45 },
  ],

  'Seating Arrangement': [
    { id: 'sa_01', text: 'Five persons A, B, C, D, E sit in a row. A is to the left of B. C sits between D and E. B is at one end. Who sits in the middle?', options: ['A', 'C', 'D', 'E'], correct: 1, subtopic: 'Linear Arrangement', time_estimate: 120 },
    { id: 'sa_02', text: '8 persons sit around a circular table facing centre. P sits opposite Q. R is 2nd to right of P. Who is to the immediate left of R?', options: ['Q', 'P', 'S', 'T'], correct: 0, subtopic: 'Circular Arrangement', time_estimate: 150 },
    { id: 'sa_03', text: 'In a row of 6 people facing north: Rohit is 3rd from left. Priya is 2nd from right. How many people sit between them?', options: ['1', '2', '3', '0'], correct: 1, subtopic: 'Linear Arrangement', time_estimate: 90 },
    { id: 'sa_04', text: '6 friends sit at a rectangular table — 3 on each side. Amit faces Priya. Ravi is to the immediate right of Amit. Who sits opposite Ravi?', options: ['Sneha', 'Priya', 'Kiran', 'Ravi'], correct: 0, subtopic: 'Rectangular Arrangement', time_estimate: 120 },
    { id: 'sa_05', text: 'A, B, C, D, E sit in a row. B is between A and C. D is to the right of E. C is at the extreme right. Who is at the extreme left?', options: ['A', 'D', 'E', 'B'], correct: 2, subtopic: 'Linear Arrangement', time_estimate: 90 },
  ],

  'Puzzles': [
    { id: 'pz_01', text: '5 people live on floors 1-5. A lives above B. C lives on the top floor. D lives below E. B is on floor 2. Who lives on floor 4?', options: ['A', 'D', 'E', 'C'], correct: 2, subtopic: 'Floor Puzzle', time_estimate: 120 },
    { id: 'pz_02', text: '4 boxes are stacked: Red, Blue, Green, Yellow. Blue is above Red. Green is at the bottom. Yellow is above Blue. What is the order from bottom to top?', options: ['G-R-B-Y', 'G-B-R-Y', 'R-G-B-Y', 'G-Y-B-R'], correct: 0, subtopic: 'Stacking Puzzle', time_estimate: 90 },
    { id: 'pz_03', text: 'A meeting is scheduled Mon–Fri. Team A meets on Wednesday. Team C meets the day before Team D. Team B meets on Monday. On which day does Team D meet?', options: ['Tuesday', 'Thursday', 'Friday', 'Wednesday'], correct: 1, subtopic: 'Scheduling Puzzle', time_estimate: 120 },
    { id: 'pz_04', text: '5 people — P, Q, R, S, T — each have a different job. P is a doctor. Q is not a teacher. R is an engineer. S is above a clerk in seniority. What is T\'s job?', options: ['Teacher', 'Clerk', 'Lawyer', 'Scientist'], correct: 0, subtopic: 'Designation Puzzle', time_estimate: 90 },
    { id: 'pz_05', text: 'Box puzzle: 6 boxes stacked. Box A is above Box C. Box B is between D and E. F is at the top. Box C is at the bottom. What position is Box A?', options: ['2nd from bottom', '3rd from top', '4th from bottom', '2nd from top'], correct: 0, subtopic: 'Stacking Puzzle', time_estimate: 120 },
  ],

  'Syllogism': [
    { id: 'sy_01', text: 'Statements: All cats are animals. Some animals are pets. Conclusion: (I) Some cats are pets. (II) Some pets are animals.', options: ['Only I follows', 'Only II follows', 'Both follow', 'Neither follows'], correct: 1, subtopic: 'Categorical Syllogism', time_estimate: 60 },
    { id: 'sy_02', text: 'Statements: No table is chair. All chairs are furniture. Conclusion: (I) No table is furniture. (II) Some furniture is not table.', options: ['Only I', 'Only II', 'Both', 'Neither'], correct: 1, subtopic: 'Negative Syllogism', time_estimate: 60 },
    { id: 'sy_03', text: 'Statements: All pens are books. All books are bags. Conclusion: All pens are bags.', options: ['True', 'False', 'Cannot determine', 'Partially true'], correct: 0, subtopic: 'Transitivity', time_estimate: 45 },
    { id: 'sy_04', text: 'Statements: Some rivers are lakes. All lakes are water bodies. Conclusion: (I) Some rivers are water bodies. (II) All water bodies are rivers.', options: ['Only I', 'Only II', 'Both', 'Neither'], correct: 0, subtopic: 'Categorical Syllogism', time_estimate: 60 },
    { id: 'sy_05', text: 'Statements: No bird is mammal. All mammals are warm-blooded. Conclusion: No bird is warm-blooded.', options: ['Definitely true', 'Definitely false', 'Possibly true', 'Cannot determine'], correct: 3, subtopic: 'Negative Syllogism', time_estimate: 60 },
  ],

  'Reading Comprehension': [
    { id: 'rc_01', text: 'Passage: "The Reserve Bank of India sets monetary policy to control inflation and stimulate growth." Q: What is the primary role of RBI according to this passage?', options: ['Regulate banks', 'Set monetary policy', 'Print currency', 'Collect taxes'], correct: 1, subtopic: 'Main Idea', time_estimate: 90 },
    { id: 'rc_02', text: 'Passage: "Digital payments surged 40% in FY2024 driven by UPI adoption." Q: Which factor primarily drove digital payment growth?', options: ['NEFT adoption', 'UPI adoption', 'Credit card usage', 'Mobile banking'], correct: 1, subtopic: 'Factual Detail', time_estimate: 75 },
    { id: 'rc_03', text: 'Passage: "The author argues that financial inclusion is incomplete without digital literacy." Q: What does the author suggest is necessary alongside financial inclusion?', options: ['Bank branches', 'Digital literacy', 'Government schemes', 'Low interest rates'], correct: 1, subtopic: 'Inference', time_estimate: 90 },
    { id: 'rc_04', text: 'Passage: "Climate change poses significant risks to agricultural output, threatening food security for developing nations." Q: What is the tone of this passage?', options: ['Optimistic', 'Cautionary', 'Satirical', 'Indifferent'], correct: 1, subtopic: 'Tone', time_estimate: 60 },
    { id: 'rc_05', text: 'Passage: "Unlike direct taxes, indirect taxes are levied on goods and services rather than income." Q: What distinguishes indirect taxes from direct taxes?', options: ['Rate of taxation', 'Levied on goods/services vs income', 'Collection method', 'Government usage'], correct: 1, subtopic: 'Contrast', time_estimate: 75 },
  ],

  'Error Spotting': [
    { id: 'es_01', text: 'Find the error: "She (A) don\'t know (B) the answer (C) to the question (D)."', options: ['A', 'B', 'C', 'D'], correct: 1, subtopic: 'Subject-Verb Agreement', time_estimate: 45 },
    { id: 'es_02', text: 'Find the error: "The committee (A) have decided (B) to postpone (C) the meeting. (D)"', options: ['A', 'B', 'C', 'D'], correct: 1, subtopic: 'Collective Noun Agreement', time_estimate: 45 },
    { id: 'es_03', text: 'Find the error: "Neither of the boys (A) are (B) ready for (C) the examination. (D)"', options: ['A', 'B', 'C', 'D'], correct: 1, subtopic: 'Subject-Verb Agreement', time_estimate: 45 },
    { id: 'es_04', text: 'Find the error: "He is one of those politicians (A) who always (B) keeps his promises (C) to the public. (D)"', options: ['A', 'B', 'C', 'D'], correct: 2, subtopic: 'Relative Clause', time_estimate: 60 },
    { id: 'es_05', text: 'Find the error: "The news (A) are (B) very disturbing (C) these days. (D)"', options: ['A', 'B', 'C', 'D'], correct: 1, subtopic: 'Uncountable Noun', time_estimate: 45 },
  ],

  'Fill in the Blanks': [
    { id: 'fib_01', text: 'The government announced a _______ plan to boost rural employment.', options: ['comprehensive', 'perplexing', 'hazardous', 'redundant'], correct: 0, subtopic: 'Vocabulary', time_estimate: 30 },
    { id: 'fib_02', text: 'Despite several setbacks, she remained _______ in her pursuit of success.', options: ['indifferent', 'resilient', 'complacent', 'reluctant'], correct: 1, subtopic: 'Vocabulary', time_estimate: 30 },
    { id: 'fib_03', text: 'The new policy aims to _______ corruption at all levels of administration.', options: ['proliferate', 'eradicate', 'perpetuate', 'condone'], correct: 1, subtopic: 'Vocabulary', time_estimate: 30 },
    { id: 'fib_04', text: 'His speech was so _______ that even complex issues became easy to understand.', options: ['verbose', 'lucid', 'ambiguous', 'pedantic'], correct: 1, subtopic: 'Contextual Usage', time_estimate: 45 },
    { id: 'fib_05', text: 'The _______ between the two countries improved significantly after the peace summit.', options: ['animosity', 'rapport', 'resentment', 'indifference'], correct: 1, subtopic: 'Vocabulary', time_estimate: 30 },
  ],

  'Cloze Test': [
    { id: 'ct_01', text: 'Cloze: "India\'s banking sector has seen _______ growth in digital transactions over the past decade." Best fit:', options: ['marginal', 'phenomenal', 'stagnant', 'erratic'], correct: 1, subtopic: 'Contextual Fill', time_estimate: 45 },
    { id: 'ct_02', text: 'Cloze: "The _______ of financial inclusion schemes has brought millions into the formal banking system." Best fit:', options: ['failure', 'success', 'reversal', 'delay'], correct: 1, subtopic: 'Contextual Fill', time_estimate: 45 },
    { id: 'ct_03', text: 'Cloze: "Aspirants must _______ their preparation by solving previous year papers." Best fit:', options: ['undermine', 'consolidate', 'abandon', 'delay'], correct: 1, subtopic: 'Contextual Fill', time_estimate: 45 },
    { id: 'ct_04', text: 'Cloze: "A _______ approach to studying ensures no topic is left uncovered." Best fit:', options: ['haphazard', 'systematic', 'spontaneous', 'casual'], correct: 1, subtopic: 'Contextual Fill', time_estimate: 45 },
    { id: 'ct_05', text: 'Cloze: "Reading newspapers daily is _______ to building strong general awareness." Best fit:', options: ['detrimental', 'indispensable', 'irrelevant', 'hazardous'], correct: 1, subtopic: 'Contextual Fill', time_estimate: 45 },
  ],

  'Para-jumbles': [
    { id: 'pj_01', text: 'Arrange: (A) resulted in higher inflation. (B) The RBI raised repo rates (C) to control money supply (D) which ultimately. Correct order:', options: ['BACD', 'BCDA', 'ABCD', 'CDBA'], correct: 1, subtopic: 'Sentence Reordering', time_estimate: 75 },
    { id: 'pj_02', text: 'Arrange: (A) financial inclusion. (B) Digital payments have (C) been instrumental in (D) driving grassroots. Correct order:', options: ['BCDA', 'ABCD', 'CDAB', 'DABC'], correct: 0, subtopic: 'Sentence Reordering', time_estimate: 75 },
    { id: 'pj_03', text: 'Find the sentence that does NOT fit: (A) Education is key. (B) Banks promote savings. (C) Schools need funding. (D) Literacy improves outcomes.', options: ['A', 'B', 'C', 'D'], correct: 1, subtopic: 'Odd One Out', time_estimate: 60 },
    { id: 'pj_04', text: 'Arrange: (1) She studied hard (2) passed the exam (3) with distinction (4) and got a job. Correct order:', options: ['1234', '1324', '1243', '2134'], correct: 0, subtopic: 'Sentence Reordering', time_estimate: 60 },
    { id: 'pj_05', text: 'Arrange the paragraph: P=Introduction, Q=Example, R=Conclusion, S=Explanation. Logical order:', options: ['PQRS', 'PSQR', 'PRQS', 'QPSR'], correct: 1, subtopic: 'Paragraph Coherence', time_estimate: 75 },
  ],

  'Blood Relations': [
    { id: 'br_01', text: 'A is the father of B. B is the sister of C. D is the mother of C. How is A related to D?', options: ['Son', 'Husband', 'Brother', 'Father'], correct: 1, subtopic: 'Family Tree', time_estimate: 60 },
    { id: 'br_02', text: 'Pointing to a woman, Raj says "Her mother is the wife of my father\'s only son." How is the woman related to Raj?', options: ['Sister', 'Daughter', 'Wife', 'Mother'], correct: 1, subtopic: 'Pointing Type', time_estimate: 75 },
    { id: 'br_03', text: 'In a family of 5: P and Q are a married couple. R is the son of Q. S is the daughter of P. T is the brother of R. How many male members are there?', options: ['2', '3', '1', '4'], correct: 1, subtopic: 'Family Structure', time_estimate: 75 },
    { id: 'br_04', text: 'X said to Y: "Your mother\'s brother is the only son of my grandfather." How is X related to Y?', options: ['Uncle', 'Cousin', 'Brother', 'Father'], correct: 1, subtopic: 'Complex Family', time_estimate: 90 },
    { id: 'br_05', text: 'A\'s father\'s sister\'s husband\'s son is B. How is B related to A?', options: ['Cousin', 'Uncle', 'Brother', 'Nephew'], correct: 0, subtopic: 'Extended Family', time_estimate: 90 },
  ],

  'Inequality': [
    { id: 'iq_01', text: 'Statements: A ≥ B > C = D. Conclusions: (I) A > D (II) B ≥ D', options: ['Only I', 'Only II', 'Both I and II', 'Neither'], correct: 2, subtopic: 'Direct Inequality', time_estimate: 45 },
    { id: 'iq_02', text: 'Statements: P ≤ Q < R, S > R. Conclusions: (I) S > P (II) S > Q', options: ['Only I', 'Only II', 'Both I and II', 'Neither'], correct: 2, subtopic: 'Chain Inequality', time_estimate: 45 },
    { id: 'iq_03', text: 'Statements: M = N ≥ O, O > P. Conclusions: (I) M > P (II) N > P', options: ['Only I', 'Only II', 'Both I and II', 'Neither'], correct: 2, subtopic: 'Transitivity', time_estimate: 45 },
    { id: 'iq_04', text: 'Statements: A < B ≤ C, D ≥ C. Conclusions: (I) D ≥ B (II) A < D', options: ['Only I', 'Only II', 'Both I and II', 'Neither'], correct: 2, subtopic: 'Combined Inequality', time_estimate: 60 },
    { id: 'iq_05', text: 'Coded inequality: A $ B means A > B; A @ B means A < B; A # B means A = B. If P $ Q # R @ S, then:', options: ['P > S', 'S > P', 'P = S', 'Cannot determine'], correct: 0, subtopic: 'Coded Inequality', time_estimate: 75 },
  ],

  'Quadratic Equations': [
    { id: 'qe_01', text: 'x² - 5x + 6 = 0 and y² - 7y + 12 = 0. Relationship between x and y?', options: ['x > y', 'x < y', 'x = y', 'x ≥ y'], correct: 1, subtopic: 'Compare Roots', time_estimate: 75 },
    { id: 'qe_02', text: 'x² - 9 = 0 and y² - 5y + 6 = 0. Values of x and y?', options: ['x ≥ y', 'y > x', 'x = y', 'x > y'], correct: 1, subtopic: 'Compare Roots', time_estimate: 60 },
    { id: 'qe_03', text: '2x² - 7x + 3 = 0 and 2y² - 9y + 4 = 0. Compare x and y:', options: ['x > y', 'x ≤ y', 'x ≥ y', 'Cannot determine'], correct: 3, subtopic: 'Fractional Roots', time_estimate: 90 },
    { id: 'qe_04', text: 'x² - 14x + 45 = 0 and y² - 16y + 63 = 0. Compare roots:', options: ['x > y', 'x < y', 'x = y', 'x ≥ y'], correct: 1, subtopic: 'Compare Roots', time_estimate: 75 },
    { id: 'qe_05', text: 'x² + 3x - 18 = 0 and y² - y - 6 = 0. Compare x and y:', options: ['x ≥ y', 'y > x', 'x > y', 'Cannot determine'], correct: 3, subtopic: 'Mixed Sign Roots', time_estimate: 90 },
  ],

  'Simplification': [
    { id: 'sim_01', text: '√625 + (18 ÷ 3) × 4 = ?', options: ['49', '45', '47', '43'], correct: 0, subtopic: 'BODMAS', time_estimate: 30 },
    { id: 'sim_02', text: '(3/4 of 240) + 30% of 200 = ?', options: ['240', '220', '260', '200'], correct: 0, subtopic: 'Fractions and Percentages', time_estimate: 45 },
    { id: 'sim_03', text: '15² - 12² + 8² = ?', options: ['113', '121', '105', '117'], correct: 0, subtopic: 'Squares', time_estimate: 45 },
    { id: 'sim_04', text: '(4096)^(1/4) × (81)^(1/2) = ?', options: ['72', '64', '78', '56'], correct: 0, subtopic: 'Roots and Powers', time_estimate: 60 },
    { id: 'sim_05', text: '45% of 820 + 55% of 680 = ?', options: ['743', '739', '751', '728'], correct: 1, subtopic: 'Percentage Calculation', time_estimate: 60 },
  ],

  'Banking Awareness': [
    { id: 'ba_01', text: 'The repo rate is the rate at which:', options: ['Banks borrow from RBI', 'RBI borrows from banks', 'Banks lend to public', 'Government borrows'], correct: 0, subtopic: 'Monetary Policy', time_estimate: 30 },
    { id: 'ba_02', text: 'PMJDY stands for:', options: ['Pradhan Mantri Jan Dhan Yojana', 'Pradhan Mantri Jan Dhyan Yojana', 'Prime Minister Jan Dhan Yatra', 'Public Money Jan Dhan Yojana'], correct: 0, subtopic: 'Government Schemes', time_estimate: 30 },
    { id: 'ba_03', text: 'The headquarters of SBI is located in:', options: ['New Delhi', 'Mumbai', 'Kolkata', 'Chennai'], correct: 1, subtopic: 'Bank Headquarters', time_estimate: 30 },
    { id: 'ba_04', text: 'CRR (Cash Reserve Ratio) is maintained by commercial banks with:', options: ['SEBI', 'Ministry of Finance', 'RBI', 'NABARD'], correct: 2, subtopic: 'Banking Regulation', time_estimate: 30 },
    { id: 'ba_05', text: 'Which of these is NOT a function of RBI?', options: ['Issue of currency', 'Banker\'s bank', 'Direct retail banking', 'Monetary policy'], correct: 2, subtopic: 'RBI Functions', time_estimate: 45 },
    { id: 'ba_06', text: 'IMPS enables fund transfer:', options: ['Only on working hours', '24×7 including holidays', 'Only on weekdays', 'Only interbank'], correct: 1, subtopic: 'Payment Systems', time_estimate: 30 },
  ],

  'General Awareness': [
    { id: 'ga_01', text: 'Which article of the Indian Constitution abolishes untouchability?', options: ['Article 14', 'Article 17', 'Article 21', 'Article 32'], correct: 1, subtopic: 'Polity', time_estimate: 30 },
    { id: 'ga_02', text: 'The Preamble of the Indian Constitution was amended in which year?', options: ['1950', '1976', '1952', '1985'], correct: 1, subtopic: 'Constitutional History', time_estimate: 45 },
    { id: 'ga_03', text: 'Sundarbans mangroves are primarily located in:', options: ['Odisha', 'West Bengal', 'Andhra Pradesh', 'Tamil Nadu'], correct: 1, subtopic: 'Geography', time_estimate: 30 },
    { id: 'ga_04', text: 'The SI unit of electric current is:', options: ['Volt', 'Watt', 'Ampere', 'Ohm'], correct: 2, subtopic: 'Science', time_estimate: 30 },
    { id: 'ga_05', text: 'Which state has the longest coastline in India?', options: ['Tamil Nadu', 'Andhra Pradesh', 'Gujarat', 'Maharashtra'], correct: 2, subtopic: 'Geography', time_estimate: 30 },
    { id: 'ga_06', text: 'The Nobel Prize for Economics 2023 was related to:', options: ['Climate change', 'Gender wage gap research', 'Inflation theory', 'AI research'], correct: 1, subtopic: 'Current Affairs', time_estimate: 45 },
  ],

  'Logical Reasoning': [
    { id: 'lr_01', text: 'If all Bloops are Razzies and all Razzies are Lazzies, then:', options: ['All Lazzies are Bloops', 'All Bloops are Lazzies', 'Some Lazzies are Bloops', 'No Bloops are Lazzies'], correct: 1, subtopic: 'Deductive Reasoning', time_estimate: 45 },
    { id: 'lr_02', text: 'In a code, MOUSE = PRXVH. What does CHAIR stand for?', options: ['FKDLU', 'FLAIR', 'FKDLV', 'EKDLU'], correct: 0, subtopic: 'Coding-Decoding', time_estimate: 60 },
    { id: 'lr_03', text: 'A man walks 5 km North, turns right walks 3 km, turns right walks 5 km. How far is he from start?', options: ['3 km', '5 km', '8 km', '13 km'], correct: 0, subtopic: 'Direction Sense', time_estimate: 60 },
    { id: 'lr_04', text: 'Odd one out: 2, 4, 8, 16, 32, 48', options: ['4', '8', '16', '48'], correct: 3, subtopic: 'Odd One Out', time_estimate: 45 },
    { id: 'lr_05', text: 'If Sunday = 1, Monday = 2, ... Saturday = 7, what day is 15th in this code system?', options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday'], correct: 0, subtopic: 'Coding', time_estimate: 45 },
  ],

  'Verbal Ability': [
    { id: 'va_01', text: 'Choose the synonym of COGENT:', options: ['Weak', 'Convincing', 'Confused', 'Ordinary'], correct: 1, subtopic: 'Synonyms', time_estimate: 30 },
    { id: 'va_02', text: 'Choose the antonym of EPHEMERAL:', options: ['Temporary', 'Permanent', 'Fleeting', 'Brief'], correct: 1, subtopic: 'Antonyms', time_estimate: 30 },
    { id: 'va_03', text: 'Choose the word closest in meaning to AMELIORATE:', options: ['Worsen', 'Improve', 'Remain', 'Confuse'], correct: 1, subtopic: 'Vocabulary', time_estimate: 30 },
    { id: 'va_04', text: 'Sentence with correct use of "affect" vs "effect": Which is correct?', options: ['"The effect on me was profound"', '"He effected me greatly"', '"The affect was negative"', '"She affected the change"'], correct: 0, subtopic: 'Word Usage', time_estimate: 45 },
    { id: 'va_05', text: 'Idiom: "Bite the bullet" means:', options: ['To be aggressive', 'To endure a difficult situation', 'To avoid confrontation', 'To act impulsively'], correct: 1, subtopic: 'Idioms', time_estimate: 30 },
  ],

  'Quantitative': [
    { id: 'qt_01', text: 'Two pipes fill a tank in 12 and 15 minutes. A drain empties it in 20 min. Time to fill if all open simultaneously?', options: ['10 min', '15 min', '12 min', '8 min'], correct: 0, subtopic: 'Pipes and Cisterns', time_estimate: 90 },
    { id: 'qt_02', text: 'A train 200m long crosses a pole in 10 seconds. Its speed in km/h is:', options: ['60', '72', '80', '90'], correct: 1, subtopic: 'Time and Distance', time_estimate: 60 },
    { id: 'qt_03', text: 'Compound interest on ₹5000 at 10% per annum for 2 years is:', options: ['₹1000', '₹1050', '₹1025', '₹1100'], correct: 1, subtopic: 'Compound Interest', time_estimate: 75 },
    { id: 'qt_04', text: 'A can do a work in 10 days, B in 15 days. Together they complete it in:', options: ['5 days', '6 days', '8 days', '12 days'], correct: 1, subtopic: 'Work and Time', time_estimate: 60 },
    { id: 'qt_05', text: 'Profit% if CP = ₹80 and SP = ₹100:', options: ['20%', '25%', '15%', '30%'], correct: 1, subtopic: 'Profit and Loss', time_estimate: 45 },
  ],
};

/* ── Helper Functions ────────────────────────────────────── */

export function getMockById(id) {
  return MOCK_CATALOG.find(m => m.id === id) || null;
}

/**
 * Select `count` questions randomly from a mock's topic pool.
 * Distributes questions evenly across the mock's topics.
 */
export function getQuestionsForMock(mock, count = 10) {
  const topics = mock.topics;
  const perTopic = Math.ceil(count / topics.length);
  const selected = [];

  for (const topic of topics) {
    const pool = QUESTION_BANK[topic] || [];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    selected.push(...shuffled.slice(0, perTopic));
  }

  // Shuffle final selection and trim to count
  return selected.sort(() => Math.random() - 0.5).slice(0, count);
}

/**
 * Compact catalog summary for system prompt injection.
 * Groups mocks by track with id + name + topics.
 */
export function getCatalogSummary() {
  const byTrack = {};
  for (const m of MOCK_CATALOG) {
    if (!byTrack[m.exam_track]) byTrack[m.exam_track] = [];
    byTrack[m.exam_track].push(`  • ${m.id} — ${m.name} [${m.difficulty}] (${m.topics.join(', ')})`);
  }
  return Object.entries(byTrack)
    .map(([track, lines]) => `${track}:\n${lines.join('\n')}`)
    .join('\n\n');
}

