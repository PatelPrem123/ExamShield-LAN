/**
 * ============================================================================
 * EXAMSHIELD LAN - COMPREHENSIVE END-TO-END INTEGRATION TEST SUITE
 * ============================================================================
 * Tests full system integration across real HTTP server, database, grading engine,
 * and security subsystems:
 *
 * 1. Server Startup & System Info Endpoint (port binding, no security leaks)
 * 2. Teacher Authentication (PIN verification, token generation, 401 enforcement)
 * 3. Configuration & Mutual Exclusivity (Competitive Mode vs Per-Q timer)
 * 4. Question Bank Management (Topic allocation & pooling)
 * 5. Student Registration & Sanitization (Clean client payload, competitive flag)
 * 6. Answer Auto-Save & Progress Tracking
 * 7. Anti-Cheat Violation & Teacher 1-Click Unfreeze Lifecycle
 * 8. Competitive Mode Submission & Scorecard Verification (+4 Right, -1 Wrong)
 * 9. Student Auto-Reconnection & Session Recovery
 * 10. Review Answers Lockdown & Publishing Flow
 * 11. Leaderboard Ranking & Master Excel / CSV Export with Right/Wrong columns
 * 12. History Log Archive End-to-End
 * ============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configure isolated environment variables BEFORE requiring server
const tempDbPath = path.join(os.tmpdir(), `examshield_integration_${Date.now()}.db`);
process.env.DB_PATH = tempDbPath;
process.env.PORT = '3099'; // Dedicated test port

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

let totalSteps = 0;
let passedSteps = 0;
let failedSteps = 0;
const failureDetails = [];

async function step(stepName, fn) {
  totalSteps++;
  try {
    await fn();
    passedSteps++;
    console.log(`  ${colors.green}✔ [STEP ${totalSteps}] PASS${colors.reset} : ${stepName}`);
  } catch (err) {
    failedSteps++;
    failureDetails.push({ stepName, error: err });
    console.log(`  ${colors.red}✖ [STEP ${totalSteps}] FAIL${colors.reset} : ${stepName}`);
    console.log(`    ${colors.yellow}${err.message}${colors.reset}`);
  }
}

async function runIntegrationTests() {
  const startTime = Date.now();
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bold}   🛡️  ExamShield LAN - Full End-to-End Integration Test Suite${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}\n`);

  // 1. Boot up real server instance
  const { app, server } = require('./src/server');
  const db = require('./src/database');

  // Wait for server to bind
  if (!server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }

  const assignedPort = server.address().port;
  const BASE_URL = `http://127.0.0.1:${assignedPort}`;
  console.log(`  ${colors.magenta}🚀 Test Server listening on: ${BASE_URL}${colors.reset}`);
  console.log(`  ${colors.magenta}🗄️  Isolated SQLite DB: ${tempDbPath}${colors.reset}\n`);

  let teacherToken = null;
  const activeExam = db.getActiveExam();
  let activeExamId = activeExam ? activeExam.id : 1;
  let testSessionId = null;
  let testStudentToken = null;
  let assignedQuestions = [];

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 1: SYSTEM INFO & HEALTH CHECK
    // ------------------------------------------------------------------------
    await step('System Info Endpoint (/api/system/info) returns valid host configuration', async () => {
      const res = await fetch(`${BASE_URL}/api/system/info`);
      assert.strictEqual(res.status, 200, 'HTTP status must be 200');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.host_ip, 'Host IP must be present');
      assert.strictEqual(Number(data.port), 3099);
      assert.ok(data.admin_url.includes('3099'), 'Admin URL must match port');
      assert.ok(data.student_url.includes('3099'), 'Student URL must match port');
      assert.strictEqual(data.exam.admin_pin, undefined, 'Admin PIN must NOT be exposed to clients');
      activeExamId = data.exam.id;
    });

    // ------------------------------------------------------------------------
    // SCENARIO 2: TEACHER SECURITY & AUTHENTICATION
    // ------------------------------------------------------------------------
    await step('Teacher Security: Rejects invalid PIN and issues token on valid PIN', async () => {
      // Wrong PIN
      const failRes = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: 'wrong_pin_999' })
      });
      assert.strictEqual(failRes.status, 401, 'Wrong PIN must return 401');

      // Correct PIN (default is admin123)
      const successRes = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: 'admin123' })
      });
      assert.strictEqual(successRes.status, 200);
      const data = await successRes.json();
      assert.ok(data.token, 'Token must be issued');
      teacherToken = data.token;
    });

    await step('Teacher Authorization: Protected route rejects unauthorized requests', async () => {
      const unauthRes = await fetch(`${BASE_URL}/api/exam/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hacked Title' })
      });
      assert.strictEqual(unauthRes.status, 401, 'Missing token must return 401');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 3: CONFIGURATION & MUTUAL EXCLUSIVITY
    // ------------------------------------------------------------------------
    await step('Exam Settings: Enable Competitive Mode (+4 / -1) and enforce Mutual Exclusivity', async () => {
      const configRes = await fetch(`${BASE_URL}/api/exam/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': teacherToken
        },
        body: JSON.stringify({
          title: 'All-India Competitive Entrance Exam',
          duration_minutes: 90,
          questions_per_topic: 10,
          passing_percentage: 50,
          competitive_mode_enabled: true,
          per_question_time_enabled: true // Testing mutual exclusivity: server should force this to false!
        })
      });
      assert.strictEqual(configRes.status, 200);
      const data = await configRes.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.exam.competitive_mode_enabled, 1, 'Competitive mode must be enabled (1)');
      assert.strictEqual(data.exam.per_question_time_enabled, 0, 'Per-Q timer must be forced to 0 due to mutual exclusivity');

      // Verify via public /api/system/info
      const sysRes = await fetch(`${BASE_URL}/api/system/info`);
      const sysData = await sysRes.json();
      assert.strictEqual(sysData.exam.title, 'All-India Competitive Entrance Exam');
      assert.strictEqual(sysData.exam.competitive_mode_enabled, 1);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 4: QUESTION BANK SEEDING
    // ------------------------------------------------------------------------
    await step('Question Bank Seeding: Insert topics and questions into database', async () => {
      db.clearAllQuestions(activeExamId);

      const testQuestions = [
        {
          topic: 'Physics',
          question_number: 1,
          question_text: 'What is the SI unit of electric current?',
          question_html: '<p>What is the SI unit of electric current?</p>',
          options: [
            { key: 'opt_0', text: 'Ampere', html: 'Ampere' },
            { key: 'opt_1', text: 'Volt', html: 'Volt' },
            { key: 'opt_2', text: 'Ohm', html: 'Ohm' },
            { key: 'opt_3', text: 'Watt', html: 'Watt' }
          ],
          correct_answers: ['opt_0'],
          is_multiple_choice: 0
        },
        {
          topic: 'Physics',
          question_number: 2,
          question_text: 'What is the speed of light in vacuum?',
          question_html: '<p>What is the speed of light in vacuum?</p>',
          options: [
            { key: 'opt_0', text: '3x10^8 m/s', html: '3x10^8 m/s' },
            { key: 'opt_1', text: '3x10^6 m/s', html: '3x10^6 m/s' },
            { key: 'opt_2', text: '3x10^5 km/s', html: '3x10^5 km/s' },
            { key: 'opt_3', text: '1.5x10^8 m/s', html: '1.5x10^8 m/s' }
          ],
          correct_answers: ['opt_0'],
          is_multiple_choice: 0
        },
        {
          topic: 'Chemistry',
          question_number: 3,
          question_text: 'What is the pH of pure water at 25 deg C?',
          question_html: '<p>What is the pH of pure water at 25 deg C?</p>',
          options: [
            { key: 'opt_0', text: '7', html: '7' },
            { key: 'opt_1', text: '0', html: '0' },
            { key: 'opt_2', text: '14', html: '14' },
            { key: 'opt_3', text: '1', html: '1' }
          ],
          correct_answers: ['opt_0'],
          is_multiple_choice: 0
        },
        {
          topic: 'Chemistry',
          question_number: 4,
          question_text: 'Which gas is evolved when zinc reacts with dilute sulfuric acid?',
          question_html: '<p>Which gas is evolved when zinc reacts with dilute sulfuric acid?</p>',
          options: [
            { key: 'opt_0', text: 'Hydrogen (H2)', html: 'Hydrogen (H2)' },
            { key: 'opt_1', text: 'Oxygen (O2)', html: 'Oxygen (O2)' },
            { key: 'opt_2', text: 'Nitrogen (N2)', html: 'Nitrogen (N2)' },
            { key: 'opt_3', text: 'Chlorine (Cl2)', html: 'Chlorine (Cl2)' }
          ],
          correct_answers: ['opt_0'],
          is_multiple_choice: 0
        }
      ];

      db.insertQuestions(activeExamId, testQuestions);
      const summary = db.getTopicsSummary(activeExamId);
      assert.strictEqual(summary.length, 2, 'Must have 2 topics');
      assert.strictEqual(summary.find(s => s.topic === 'Physics').count, 2);
      assert.strictEqual(summary.find(s => s.topic === 'Chemistry').count, 2);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 5: STUDENT REGISTRATION & SANITIZATION
    // ------------------------------------------------------------------------
    await step('Student Registration: Issues randomized sanitized paper with Competitive Mode active', async () => {
      const regRes = await fetch(`${BASE_URL}/api/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: 'Ananya Deshmukh' })
      });

      assert.strictEqual(regRes.status, 200);
      const data = await regRes.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.student_name, 'Ananya Deshmukh');
      assert.strictEqual(data.competitive_mode_enabled, true, 'Student must receive competitive_mode_enabled: true');
      assert.strictEqual(data.questions.length, 4, 'Must receive 4 questions');

      // Security Check: verify correct_answers are completely absent
      for (const q of data.questions) {
        assert.strictEqual(q.correct_keys, undefined, 'Client question must not contain correct_keys');
        assert.strictEqual(q.correct_answers, undefined, 'Client question must not contain correct_answers');
      }

      assert.ok(data.student_token, 'Registration must issue a cryptographic student auth token');
      testSessionId = data.session_id;
      testStudentToken = data.student_token;
      assignedQuestions = data.questions;
    });

    // ------------------------------------------------------------------------
    // SCENARIO 6: ANSWER SELECTION & PERSISTENCE
    // ------------------------------------------------------------------------
    await step('Student Answer Persistence: Auto-saves chosen answers into session record', async () => {
      const q1 = assignedQuestions[0];
      const selectedKey = q1.options[0].key;

      db.saveAnswer(testSessionId, q1.id, [selectedKey]);
      const sessionInDb = db.getSessionById(testSessionId);
      assert.deepStrictEqual(sessionInDb.answers[q1.id], [selectedKey]);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 7: ANTI-CHEAT DETECTION & 1-CLICK UNFREEZE LIFECYCLE
    // ------------------------------------------------------------------------
    await step('Anti-Cheat Lifecycle: Focus lost freezes attempt -> Teacher unfreezes session', async () => {
      // Simulate Focus Lost violation
      db.freezeStudentSession(testSessionId, 'Window blur / Alt+Tab violation');
      let session = db.getSessionById(testSessionId);
      assert.strictEqual(session.status, 'frozen');
      assert.ok(session.freeze_reason.includes('Alt+Tab'));

      // Teacher unfreezes session via API
      const unfreezeRes = await fetch(`${BASE_URL}/api/teacher/unfreeze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': teacherToken
        },
        body: JSON.stringify({ session_id: testSessionId })
      });

      assert.strictEqual(unfreezeRes.status, 200);
      const unfreezeData = await unfreezeRes.json();
      assert.strictEqual(unfreezeData.success, true);

      session = db.getSessionById(testSessionId);
      assert.strictEqual(session.status, 'in_progress', 'Session must be restored to in_progress');
      assert.strictEqual(session.freeze_reason, null);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 8: COMPETITIVE EXAM SUBMISSION (+4 / -1 / 0)
    // ------------------------------------------------------------------------
    await step('Competitive Exam Submission: Grades with +4 for Right, -1 for Wrong, 0 for Skipped', async () => {
      // Full assigned questions from DB with correct keys
      const fullSession = db.getSessionById(testSessionId);
      const questionsWithKeys = fullSession.assigned_questions;

      // Plan answers for 4 questions:
      // Q1: Correct (+4)
      // Q2: Correct (+4)
      // Q3: Wrong (-1)
      // Q4: Unattempted (0)
      // Expected Score = 4 + 4 - 1 + 0 = 7 out of 16 (43.8%)
      const stagedAnswers = {};
      stagedAnswers[questionsWithKeys[0].id] = questionsWithKeys[0].correct_keys; // Correct
      stagedAnswers[questionsWithKeys[1].id] = questionsWithKeys[1].correct_keys; // Correct
      stagedAnswers[questionsWithKeys[2].id] = ['wrong_option_key']; // Wrong
      // Q3 (index 3) is unattempted

      // Save staged answers
      for (const [qId, ans] of Object.entries(stagedAnswers)) {
        db.saveAnswer(testSessionId, qId, ans);
      }

      // Security Check: Attempting to submit with a bogus/spoofed token must be rejected with 403 Forbidden
      const spoofRes = await fetch(`${BASE_URL}/api/student/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-student-token': 'fake_malicious_token' },
        body: JSON.stringify({ session_id: testSessionId, student_token: 'fake_malicious_token' })
      });
      assert.strictEqual(spoofRes.status, 403, 'Spoofed token must return 403 Forbidden');

      // Submit via API with valid student token
      const submitRes = await fetch(`${BASE_URL}/api/student/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-student-token': testStudentToken },
        body: JSON.stringify({ session_id: testSessionId, student_token: testStudentToken })
      });

      assert.strictEqual(submitRes.status, 200);
      const submitData = await submitRes.json();
      assert.strictEqual(submitData.success, true);

      const result = submitData.result;
      assert.strictEqual(result.competitive_mode, true, 'Result must be flagged competitive_mode: true');
      assert.strictEqual(result.correct_count, 2, 'Right answers count must be 2');
      assert.strictEqual(result.wrong_count, 1, 'Wrong answers count must be 1');
      assert.strictEqual(result.unattempted_count, 1, 'Unattempted count must be 1');
      assert.strictEqual(result.total_score, 7, 'Score must be (2*4) - (1*1) = 7');
      assert.strictEqual(result.max_score, 16, 'Max marks must be 4 questions * 4 = 16');
      assert.strictEqual(result.percentage, 43.8, 'Percentage must be (7/16)*100 = 43.8%');
      assert.strictEqual(result.passed, false, '43.8% is below 50% passing -> FAILED');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 9: AUTO-RECONNECTION ON SUBMITTED EXAM
    // ------------------------------------------------------------------------
    await step('Student Reconnect: Rejoining returns scorecard with Right/Wrong counts', async () => {
      const reconnectRes = await fetch(`${BASE_URL}/api/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: 'Ananya Deshmukh' })
      });

      assert.strictEqual(reconnectRes.status, 200);
      const data = await reconnectRes.json();
      assert.strictEqual(data.is_reconnect, true);
      assert.strictEqual(data.status, 'submitted');
      assert.strictEqual(data.result.total_score, 7);
      assert.strictEqual(data.result.correct_count, 2);
      assert.strictEqual(data.result.wrong_count, 1);
      assert.strictEqual(data.result.unattempted_count, 1);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 10: ANSWER REVIEW LOCKDOWN & GLOBAL PUBLISH
    // ------------------------------------------------------------------------
    await step('Answer Key Access: Forbidden when locked -> Accessible once published by Teacher', async () => {
      // 1. Should be 403 Forbidden while locked
      const lockedRes = await fetch(`${BASE_URL}/api/student/review/${testSessionId}`, {
        headers: { 'x-student-token': testStudentToken }
      });
      assert.strictEqual(lockedRes.status, 403, 'Review must be blocked when unpublished');

      // 2. Teacher publishes review for ALL students
      const pubRes = await fetch(`${BASE_URL}/api/teacher/review-permission/all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': teacherToken
        },
        body: JSON.stringify({ publish_all: true })
      });
      assert.strictEqual(pubRes.status, 200);

      // 3. Student can now access review
      const openRes = await fetch(`${BASE_URL}/api/student/review/${testSessionId}`, {
        headers: { 'x-student-token': testStudentToken }
      });
      assert.strictEqual(openRes.status, 200);
      const reviewData = await openRes.json();
      assert.strictEqual(reviewData.success, true);
      assert.strictEqual(reviewData.allow_review, true);
      assert.ok(Array.isArray(reviewData.review_questions));
      assert.strictEqual(reviewData.review_questions.length, 4);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 11: LEADERBOARD, EXCEL & CSV EXPORTS
    // ------------------------------------------------------------------------
    await step('Teacher Reports: Leaderboard ranking & CSV/Excel download with Right/Wrong columns', async () => {
      // Register and submit a 2nd student who gets 100% (Rank 1)
      const reg2 = await fetch(`${BASE_URL}/api/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: 'Vikram Seth' })
      });
      const data2 = await reg2.json();
      const s2Db = db.getSessionById(data2.session_id);
      for (const q of s2Db.assigned_questions) {
        db.saveAnswer(data2.session_id, q.id, q.correct_keys);
      }
      await fetch(`${BASE_URL}/api/student/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-student-token': data2.student_token },
        body: JSON.stringify({ session_id: data2.session_id, student_token: data2.student_token })
      });

      // 1. Check /api/teacher/students
      const listRes = await fetch(`${BASE_URL}/api/teacher/students`, {
        headers: { 'x-admin-token': teacherToken }
      });
      assert.strictEqual(listRes.status, 200);
      const listData = await listRes.json();
      assert.strictEqual(listData.students.length, 2);

      const vikram = listData.students.find(s => s.student_name === 'Vikram Seth');
      const ananya = listData.students.find(s => s.student_name === 'Ananya Deshmukh');
      assert.strictEqual(vikram.rank, 1, 'Vikram (100%) must be Rank 1');
      assert.strictEqual(vikram.total_score, 16);
      assert.strictEqual(vikram.correct_count, 4);
      assert.strictEqual(vikram.wrong_count, 0);

      assert.strictEqual(ananya.rank, 2, 'Ananya (43.8%) must be Rank 2');
      assert.strictEqual(ananya.correct_count, 2);
      assert.strictEqual(ananya.wrong_count, 1);

      // 2. Download CSV Export
      const csvRes = await fetch(`${BASE_URL}/api/export/excel?sort=rank&format=csv&token=${teacherToken}`);
      assert.strictEqual(csvRes.status, 200);
      const csvText = await csvRes.text();
      assert.ok(csvText.includes('Right Answers'), 'CSV must contain Right Answers column');
      assert.ok(csvText.includes('Wrong Answers'), 'CSV must contain Wrong Answers column');
      assert.ok(csvText.includes('Vikram Seth'), 'CSV must contain candidate record');

      // 3. Download Excel Export
      const excelRes = await fetch(`${BASE_URL}/api/export/excel?sort=rank&format=xlsx&token=${teacherToken}`);
      assert.strictEqual(excelRes.status, 200);
      const excelBuf = await excelRes.arrayBuffer();
      assert.ok(excelBuf.byteLength > 5000, 'Excel output must be non-empty valid workbook');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 12: AUDIT HISTORY ARCHIVE
    // ------------------------------------------------------------------------
    await step('Audit History Archive: Successfully logs attempts to history log', async () => {
      const histRes = await fetch(`${BASE_URL}/api/history`, {
        headers: { 'x-admin-token': teacherToken }
      });
      assert.strictEqual(histRes.status, 200);
      const histData = await histRes.json();
      assert.strictEqual(histData.success, true);
      assert.ok(typeof histData.history === 'string');
    });

  } finally {
    // Graceful teardown
    console.log(`\n  ${colors.dim}Shutting down integration test server...${colors.reset}`);
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
  // INTEGRATION TEST SUMMARY REPORT
  // --------------------------------------------------------------------------
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bold}   INTEGRATION TEST SUMMARY REPORT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`  Total Scenarios : ${totalSteps}`);
  console.log(`  Passed Steps    : ${colors.green}${passedSteps}${colors.reset}`);
  console.log(`  Failed Steps    : ${failedSteps > 0 ? colors.red + failedSteps + colors.reset : '0'}`);
  console.log(`  Total Duration  : ${duration}s`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);

  if (failedSteps > 0) {
    console.log(`\n${colors.red}${colors.bold}Failed Step Details:${colors.reset}`);
    failureDetails.forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f.stepName}`);
      console.log(`     ${f.error.stack || f.error.message}\n`);
    });
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!${colors.reset}\n`);
    process.exit(0);
  }
}

runIntegrationTests().catch(err => {
  console.error('Integration Test Runner Fatal Error:', err);
  process.exit(1);
});
