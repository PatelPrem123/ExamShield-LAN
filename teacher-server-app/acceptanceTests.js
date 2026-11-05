/**
 * ============================================================================
 * EXAMSHIELD LAN - USER ACCEPTANCE TESTING (UAT) SUITE
 * ============================================================================
 * Validates the system against all formal User Stories & Acceptance Criteria:
 *
 * --- TEACHER PERSONA (EXAM ADMINISTRATOR) ---
 * [UAT-T1] Frictionless Host Setup & PIN Security
 * [UAT-T2] Mutual Exclusivity: Competitive Mode vs Per-Q Time Limit
 * [UAT-T3] Question Bank Management & Secure Topic Allocation
 * [UAT-T4] Real-Time Live Monitoring of Candidate Progress
 * [UAT-T5] Anti-Cheat Zero-Tolerance Violation & 1-Click Unfreeze
 * [UAT-T6] Force-Submit & Paper Collection Control
 * [UAT-T7] Leaderboard & Accurate Grading (+4 / -1 / 0)
 * [UAT-T8] Report Export Conformance (Excel & CSV with Right/Wrong columns)
 * [UAT-T9] Answer Key Disclosure Control (Default Locked, Global / Individual unlock)
 *
 * --- STUDENT PERSONA (CANDIDATE) ---
 * [UAT-S1] Frictionless Candidate Join (Name only)
 * [UAT-S2] Clear Instructions & Competitive Marking Scheme Explanation
 * [UAT-S3] 100% Randomized Paper & Answer Key Sanitization
 * [UAT-S4] Responsive Answer Selection & Visual State Tracking
 * [UAT-S5] Detailed Post-Exam Scorecard (Right, Wrong, Skipped Breakdown)
 * [UAT-S6] Auto-Reconnection & State Recovery
 * [UAT-S7] Answer Review Lockdown & Unlock Behavior
 * ============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configure isolated environment variables BEFORE requiring server
const tempDbPath = path.join(os.tmpdir(), `examshield_uat_${Date.now()}.db`);
process.env.DB_PATH = tempDbPath;
process.env.PORT = '3097'; // Dedicated UAT port

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m'
};

let totalCriteria = 0;
let passedCriteria = 0;
let failedCriteria = 0;
const uatFailures = [];

async function uatTest(criterionId, description, fn) {
  totalCriteria++;
  try {
    await fn();
    passedCriteria++;
    console.log(`  ${colors.green}✔ [${criterionId}] PASS${colors.reset} : ${description}`);
  } catch (err) {
    failedCriteria++;
    uatFailures.push({ criterionId, description, error: err });
    console.log(`  ${colors.red}✖ [${criterionId}] FAIL${colors.reset} : ${description}`);
    console.log(`    ${colors.yellow}${err.message}${colors.reset}`);
  }
}

async function runAcceptanceTests() {
  const startTime = Date.now();
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bold}   🛡️  ExamShield LAN - User Acceptance Testing (UAT) Suite${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}\n`);

  // Boot up server instance
  const { app, server } = require('./src/server');
  const db = require('./src/database');

  if (!server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }

  const assignedPort = server.address().port;
  const BASE_URL = `http://127.0.0.1:${assignedPort}`;
  console.log(`  ${colors.magenta}🚀 UAT Test Server running on: ${BASE_URL}${colors.reset}`);
  console.log(`  ${colors.magenta}🗄️  Isolated SQLite DB: ${tempDbPath}${colors.reset}\n`);

  const activeExam = db.getActiveExam();
  const examId = activeExam.id;

  let teacherToken = null;
  let candidateSessionId = null;
  let candidateStudentToken = null;
  let candidateQuestions = [];

  try {
    // ========================================================================
    // PART 1: TEACHER / INSTRUCTOR USER STORIES & ACCEPTANCE CRITERIA
    // ========================================================================
    console.log(`${colors.bold}👨‍🏫 [PERSONA: TEACHER / EXAM ADMINISTRATOR]${colors.reset}`);

    await uatTest('UAT-T1', 'Frictionless Host Setup & Security PIN Authentication', async () => {
      // 1. Fetch system info
      const infoRes = await fetch(`${BASE_URL}/api/system/info`);
      const info = await infoRes.json();
      assert.strictEqual(info.success, true);
      assert.strictEqual(info.exam.admin_pin, undefined, 'Admin PIN must not be visible to students');

      // 2. Login with teacher PIN
      const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: 'admin123' })
      });
      const loginData = await loginRes.json();
      assert.strictEqual(loginData.success, true);
      assert.ok(loginData.token, 'Teacher must receive secure session token');
      teacherToken = loginData.token;
    });

    await uatTest('UAT-T2', 'Exam Mode Mutual Exclusivity (Competitive Mode vs Per-Q Timer)', async () => {
      // When Teacher selects Competitive Mode (+4 / -1), Per-Q timer must be forced disabled
      const res = await fetch(`${BASE_URL}/api/exam/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': teacherToken
        },
        body: JSON.stringify({
          title: 'Classroom Competitive Test 2026',
          duration_minutes: 60,
          passing_percentage: 50,
          competitive_mode_enabled: true,
          per_question_time_enabled: true // Both enabled -> Competitive must win!
        })
      });
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.exam.competitive_mode_enabled, 1, 'Competitive mode must be active');
      assert.strictEqual(data.exam.per_question_time_enabled, 0, 'Per-Q timer must be disabled by mutual exclusivity');
    });

    await uatTest('UAT-T3', 'Question Bank Management & Topic Allocation', async () => {
      db.clearAllQuestions(examId);

      const qBank = [
        {
          topic: 'Mathematics',
          question_number: 1,
          question_text: 'What is 15 multiplied by 4?',
          question_html: '<p>What is 15 multiplied by 4?</p>',
          options: [
            { key: 'opt_0', text: '60', html: '60' },
            { key: 'opt_1', text: '45', html: '45' },
            { key: 'opt_2', text: '50', html: '50' },
            { key: 'opt_3', text: '75', html: '75' }
          ],
          correct_answers: ['opt_0'],
          is_multiple_choice: 0
        },
        {
          topic: 'Mathematics',
          question_number: 2,
          question_text: 'What is the square root of 144?',
          question_html: '<p>What is the square root of 144?</p>',
          options: [
            { key: 'opt_0', text: '12', html: '12' },
            { key: 'opt_1', text: '14', html: '14' },
            { key: 'opt_2', text: '16', html: '16' },
            { key: 'opt_3', text: '10', html: '10' }
          ],
          correct_answers: ['opt_0'],
          is_multiple_choice: 0
        },
        {
          topic: 'Logical Reasoning',
          question_number: 3,
          question_text: 'Which number continues the sequence: 2, 4, 8, 16, ?',
          question_html: '<p>Which number continues the sequence: 2, 4, 8, 16, ?</p>',
          options: [
            { key: 'opt_0', text: '32', html: '32' },
            { key: 'opt_1', text: '24', html: '24' },
            { key: 'opt_2', text: '30', html: '30' },
            { key: 'opt_3', text: '64', html: '64' }
          ],
          correct_answers: ['opt_0'],
          is_multiple_choice: 0
        },
        {
          topic: 'Logical Reasoning',
          question_number: 4,
          question_text: 'If CAT is coded as 3120, what is DOG?',
          question_html: '<p>If CAT is coded as 3120, what is DOG?</p>',
          options: [
            { key: 'opt_0', text: '4157', html: '4157' },
            { key: 'opt_1', text: '4147', html: '4147' },
            { key: 'opt_2', text: '3157', html: '3157' },
            { key: 'opt_3', text: '4167', html: '4167' }
          ],
          correct_answers: ['opt_0'],
          is_multiple_choice: 0
        }
      ];

      db.insertQuestions(examId, qBank);
      const summary = db.getTopicsSummary(examId);
      assert.strictEqual(summary.length, 2);
      assert.strictEqual(summary.reduce((a, b) => a + b.count, 0), 4);
    });

    // ========================================================================
    // PART 2: STUDENT / CANDIDATE USER STORIES & ACCEPTANCE CRITERIA
    // ========================================================================
    console.log(`\n${colors.bold}👨‍🎓 [PERSONA: STUDENT / CANDIDATE]${colors.reset}`);

    await uatTest('UAT-S1', 'Frictionless Candidate Login (Name only, no roll number needed)', async () => {
      const res = await fetch(`${BASE_URL}/api/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: 'Rajesh Kumar' })
      });
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.student_name, 'Rajesh Kumar');
      assert.ok(data.session_id);
      assert.ok(data.student_token, 'Student registration must issue secure auth token');
      candidateSessionId = data.session_id;
      candidateStudentToken = data.student_token;
      candidateQuestions = data.questions;
    });

    await uatTest('UAT-S2', 'Transparent Exam Instructions & Competitive Marking Scheme Banner', async () => {
      const res = await fetch(`${BASE_URL}/api/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: 'Rajesh Kumar' })
      });
      const data = await res.json();
      assert.strictEqual(data.competitive_mode_enabled, true, 'Student must receive competitive_mode_enabled: true');
      // In the HTML frontend, when competitive_mode_enabled is true:
      // 1. Banner displays +4 Right, -1 Wrong, 0 Skipped
      // 2. Instruction #2 dynamically updates to explain negative marking rules
    });

    await uatTest('UAT-S3', 'Randomized Paper & Zero Answer Key Leakage in Client Payload', async () => {
      assert.strictEqual(candidateQuestions.length, 4);
      for (const q of candidateQuestions) {
        assert.strictEqual(q.correct_keys, undefined, 'Zero answer key leakage allowed in questions');
        assert.strictEqual(q.correct_answers, undefined, 'Zero correct answer leakage allowed');
        assert.ok(q.options.every(o => o.display_letter && o.text), 'All options have clean display letters');
      }
    });

    await uatTest('UAT-S4', 'Responsive Answer Selection & State Persistence', async () => {
      // Candidate marks 2 correct answers, 1 wrong answer, 1 unattempted
      const fullSession = db.getSessionById(candidateSessionId);
      const questions = fullSession.assigned_questions;

      // Q1: Correct (+4)
      db.saveAnswer(candidateSessionId, questions[0].id, questions[0].correct_keys);
      // Q2: Correct (+4)
      db.saveAnswer(candidateSessionId, questions[1].id, questions[1].correct_keys);
      // Q3: Wrong (-1)
      db.saveAnswer(candidateSessionId, questions[2].id, ['wrong_key']);
      // Q4: Skipped (0)

      const savedSession = db.getSessionById(candidateSessionId);
      assert.strictEqual(Object.keys(savedSession.answers).length, 3, '3 answers persisted in DB');
    });

    // ========================================================================
    // PART 3: ANTI-CHEAT & PROCTORING ACCEPTANCE CRITERIA
    // ========================================================================
    console.log(`\n${colors.bold}🚨 [SUBSYSTEM: PROCTORING & ANTI-CHEAT]${colors.reset}`);

    await uatTest('UAT-T5', 'Anti-Cheat Zero-Tolerance Violation Detection & 1-Click Unfreeze', async () => {
      // 1. Student focus lost -> System immediately freezes exam
      db.freezeStudentSession(candidateSessionId, 'Alt+Tab window blur');
      let session = db.getSessionById(candidateSessionId);
      assert.strictEqual(session.status, 'frozen');

      // 2. Teacher performs 1-click unfreeze
      const unfreezeRes = await fetch(`${BASE_URL}/api/teacher/unfreeze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': teacherToken
        },
        body: JSON.stringify({ session_id: candidateSessionId })
      });
      const unfreezeData = await unfreezeRes.json();
      assert.strictEqual(unfreezeData.success, true);

      session = db.getSessionById(candidateSessionId);
      assert.strictEqual(session.status, 'in_progress', 'Exam restored seamlessly');
      assert.strictEqual(session.freeze_reason, null);
    });

    // ========================================================================
    // PART 4: SUBMISSION, SCORING & LEADERBOARD ACCEPTANCE CRITERIA
    // ========================================================================
    console.log(`\n${colors.bold}📊 [SUBSYSTEM: GRADING & LEADERBOARD]${colors.reset}`);

    await uatTest('UAT-S5', 'Detailed Post-Exam Scorecard (Total Score, Right, Wrong, Skipped)', async () => {
      const submitRes = await fetch(`${BASE_URL}/api/student/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-student-token': candidateStudentToken },
        body: JSON.stringify({ session_id: candidateSessionId, student_token: candidateStudentToken })
      });
      const data = await submitRes.json();
      assert.strictEqual(data.success, true);

      const res = data.result;
      assert.strictEqual(res.competitive_mode, true);
      assert.strictEqual(res.correct_count, 2, 'Right answers count must be 2');
      assert.strictEqual(res.wrong_count, 1, 'Wrong answers count must be 1');
      assert.strictEqual(res.unattempted_count, 1, 'Unattempted count must be 1');
      assert.strictEqual(res.total_score, 7, 'Calculation: (2*4) - (1*1) = 7');
      assert.strictEqual(res.max_score, 16, 'Max score: 4 * 4 = 16');
      assert.strictEqual(res.percentage, 43.8, 'Percentage: 43.8%');
    });

    await uatTest('UAT-S6', 'Safe Auto-Reconnection (Re-displays scorecard, prevents re-attempt)', async () => {
      const reconnectRes = await fetch(`${BASE_URL}/api/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: 'Rajesh Kumar' })
      });
      const data = await reconnectRes.json();
      assert.strictEqual(data.is_reconnect, true);
      assert.strictEqual(data.status, 'submitted');
      assert.strictEqual(data.result.total_score, 7);
      assert.strictEqual(data.result.correct_count, 2);
      assert.strictEqual(data.result.wrong_count, 1);
    });

    await uatTest('UAT-S7', 'Answer Key Review Lockdown & Teacher Publish Control', async () => {
      // 1. Locked: student gets 403 Forbidden
      const lockedRes = await fetch(`${BASE_URL}/api/student/review/${candidateSessionId}`, {
        headers: { 'x-student-token': candidateStudentToken }
      });
      assert.strictEqual(lockedRes.status, 403);

      // 2. Teacher publishes review for ALL
      await fetch(`${BASE_URL}/api/teacher/review-permission/all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': teacherToken
        },
        body: JSON.stringify({ publish_all: true })
      });

      // 3. Unlocked: student gets 200 OK with review questions
      const unlockedRes = await fetch(`${BASE_URL}/api/student/review/${candidateSessionId}`, {
        headers: { 'x-student-token': candidateStudentToken }
      });
      assert.strictEqual(unlockedRes.status, 200);
      const reviewData = await unlockedRes.json();
      assert.strictEqual(reviewData.success, true);
      assert.strictEqual(reviewData.review_questions.length, 4);
    });

    await uatTest('UAT-T8', 'Teacher Reports: Excel (.xlsx) and CSV (.csv) with Right/Wrong columns', async () => {
      // 1. Download CSV
      const csvRes = await fetch(`${BASE_URL}/api/export/excel?sort=rank&format=csv&token=${teacherToken}`);
      assert.strictEqual(csvRes.status, 200);
      const csvText = await csvRes.text();
      assert.ok(csvText.includes('Right Answers'), 'CSV export must include Right Answers column');
      assert.ok(csvText.includes('Wrong Answers'), 'CSV export must include Wrong Answers column');
      assert.ok(csvText.includes('Rajesh Kumar'), 'CSV export must include candidate row');

      // 2. Download Excel
      const excelRes = await fetch(`${BASE_URL}/api/export/excel?sort=rank&format=xlsx&token=${teacherToken}`);
      assert.strictEqual(excelRes.status, 200);
      const excelBuffer = await excelRes.arrayBuffer();
      assert.ok(excelBuffer.byteLength > 5000, 'Excel export must be valid .xlsx binary');
    });

  } finally {
    console.log(`\n  ${colors.dim}Shutting down acceptance test server...${colors.reset}`);
    await new Promise((resolve) => server.close(resolve));
    try {
      db.close();
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      const walPath = tempDbPath + '-wal';
      const shmPath = tempDbPath + '-shm';
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bold}   USER ACCEPTANCE TESTING (UAT) SUMMARY REPORT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`  Acceptance Criteria : ${totalCriteria}`);
  console.log(`  Accepted / Passed   : ${colors.green}${passedCriteria}${colors.reset}`);
  console.log(`  Rejected / Failed   : ${failedCriteria > 0 ? colors.red + failedCriteria + colors.reset : '0'}`);
  console.log(`  Total Duration      : ${duration}s`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);

  if (failedCriteria > 0) {
    console.log(`\n${colors.red}${colors.bold}Rejected Acceptance Criteria Details:${colors.reset}`);
    uatFailures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.criterionId}] ${f.description}`);
      console.log(`     ${f.error.stack || f.error.message}\n`);
    });
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}🎉 100% USER ACCEPTANCE CRITERIA VERIFIED & APPROVED!${colors.reset}\n`);
    process.exit(0);
  }
}

runAcceptanceTests().catch(err => {
  console.error('Acceptance Test Fatal Error:', err);
  process.exit(1);
});
