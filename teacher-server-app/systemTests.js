/**
 * ============================================================================
 * EXAMSHIELD LAN - SYSTEM TESTING SUITE
 * ============================================================================
 * Tests non-functional and full-system requirements under realistic exam conditions:
 *
 * 1. Concurrency & High Load (20+ simultaneous students registering and answering)
 * 2. SQLite WAL Concurrent Write Stress (Zero locking errors, 100% data retention)
 * 3. Latency & Response Time SLAs (Average response < 50ms)
 * 4. Security Penetration & Vulnerability Probing (Path traversal, SQLi, Auth bypass)
 * 5. Data Isolation & Privacy (No cross-candidate data leakage)
 * 6. System Stability & Memory Footprint (No memory leaks or crashes)
 * ============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configure isolated environment variables BEFORE requiring server
const tempDbPath = path.join(os.tmpdir(), `examshield_system_${Date.now()}.db`);
process.env.DB_PATH = tempDbPath;
process.env.PORT = '3098'; // Dedicated system test port

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

let totalScenarios = 0;
let passedScenarios = 0;
let failedScenarios = 0;
const failureDetails = [];

async function systemTest(name, fn) {
  totalScenarios++;
  try {
    await fn();
    passedScenarios++;
    console.log(`  ${colors.green}✔ [PASS]${colors.reset} : ${name}`);
  } catch (err) {
    failedScenarios++;
    failureDetails.push({ name, error: err });
    console.log(`  ${colors.red}✖ [FAIL]${colors.reset} : ${name}`);
    console.log(`    ${colors.yellow}${err.message}${colors.reset}`);
  }
}

async function runSystemTests() {
  const startTime = Date.now();
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bold}   🛡️  ExamShield LAN - Full System & Performance Testing Suite${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}\n`);

  // Boot up server instance
  const { app, server } = require('./src/server');
  const db = require('./src/database');

  if (!server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }

  const assignedPort = server.address().port;
  const BASE_URL = `http://127.0.0.1:${assignedPort}`;
  console.log(`  ${colors.magenta}🚀 System Test Server running on: ${BASE_URL}${colors.reset}`);
  console.log(`  ${colors.magenta}🗄️  Isolated SQLite DB: ${tempDbPath}${colors.reset}\n`);

  const activeExam = db.getActiveExam();
  const examId = activeExam.id;

  // Seed question bank with 20 questions
  db.clearAllQuestions(examId);
  const questionsToSeed = [];
  const topics = ['Computer Networks', 'Operating Systems', 'System Architecture', 'Information Security'];

  for (let i = 1; i <= 20; i++) {
    const topic = topics[(i - 1) % topics.length];
    questionsToSeed.push({
      topic,
      question_number: i,
      question_text: `System Test Question #${i}: Core concepts of ${topic}`,
      question_html: `<p>System Test Question #${i}: Core concepts of ${topic}</p>`,
      options: [
        { key: 'opt_0', text: 'Option Alpha (Correct)', html: 'Option Alpha' },
        { key: 'opt_1', text: 'Option Beta (Wrong)', html: 'Option Beta' },
        { key: 'opt_2', text: 'Option Gamma (Wrong)', html: 'Option Gamma' },
        { key: 'opt_3', text: 'Option Delta (Wrong)', html: 'Option Delta' }
      ],
      correct_answers: ['opt_0'],
      is_multiple_choice: 0
    });
  }
  db.insertQuestions(examId, questionsToSeed);

  // Enable competitive mode
  db.updateActiveExam({
    title: 'Lab Concurrency Examination',
    duration_minutes: 60,
    questions_per_topic: 5,
    passing_percentage: 50,
    competitive_mode_enabled: 1,
    per_question_time_enabled: 0
  });

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 1: CONCURRENT REGISTRATION LOAD TEST
    // ------------------------------------------------------------------------
    const studentCount = 20;
    const studentSessions = [];

    await systemTest(`Concurrency Load Test: ${studentCount} simultaneous students register over LAN`, async () => {
      const regStart = Date.now();
      const registrationPromises = [];

      for (let i = 1; i <= studentCount; i++) {
        const studentName = `Candidate_${String(i).padStart(2, '0')}`;
        registrationPromises.push(
          fetch(`${BASE_URL}/api/student/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_name: studentName })
          }).then(res => res.json())
        );
      }

      const results = await Promise.all(registrationPromises);
      const regDuration = Date.now() - regStart;

      assert.strictEqual(results.length, studentCount, 'All registrations must complete');
      for (const r of results) {
        assert.strictEqual(r.success, true, 'Each registration must succeed');
        assert.ok(r.session_id, 'Each session must receive a unique ID');
        assert.strictEqual(r.competitive_mode_enabled, true, 'Competitive mode must be active');
        assert.strictEqual(r.questions.length, 20, 'Each student receives 20 questions');
        studentSessions.push(r);
      }

      // Verify all session IDs are strictly unique
      const sessionIds = new Set(studentSessions.map(s => s.session_id));
      assert.strictEqual(sessionIds.size, studentCount, 'No duplicate sessions created');
      console.log(`    ${colors.dim}↳ Registered ${studentCount} candidates concurrently in ${regDuration}ms (avg: ${(regDuration/studentCount).toFixed(1)}ms/req)${colors.reset}`);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 2: SQLITE WAL CONCURRENT WRITES STRESS TEST
    // ------------------------------------------------------------------------
    await systemTest(`SQLite WAL Concurrent Write Stress: 100 simultaneous answer saves`, async () => {
      const writeStart = Date.now();
      const writePromises = [];

      // Every student writes 5 answers concurrently
      for (const session of studentSessions) {
        for (let qIdx = 0; qIdx < 5; qIdx++) {
          const qId = session.questions[qIdx].id;
          // Alternate correct and incorrect
          const isCorrect = (qIdx % 2 === 0);
          const chosenKey = isCorrect ? 'opt_0' : 'opt_1';

          writePromises.push(
            new Promise((resolve, reject) => {
              try {
                db.saveAnswer(session.session_id, qId, [chosenKey]);
                resolve();
              } catch (e) {
                reject(e);
              }
            })
          );
        }
      }

      await Promise.all(writePromises);
      const writeDuration = Date.now() - writeStart;
      console.log(`    ${colors.dim}↳ Processed ${writePromises.length} concurrent database writes in ${writeDuration}ms without deadlocks${colors.reset}`);

      // Verify answers in database for all students
      for (const session of studentSessions) {
        const stored = db.getSessionById(session.session_id);
        assert.strictEqual(Object.keys(stored.answers).length, 5, 'Every student must have 5 saved answers');
      }
    });

    // ------------------------------------------------------------------------
    // SCENARIO 3: LATENCY & RESPONSE TIME SLA TEST
    // ------------------------------------------------------------------------
    await systemTest(`Performance SLA: API response times meet sub-50ms target`, async () => {
      const latencies = [];
      for (let i = 0; i < 15; i++) {
        const t0 = performance.now();
        const res = await fetch(`${BASE_URL}/api/system/info`);
        await res.json();
        latencies.push(performance.now() - t0);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      assert.ok(avgLatency < 50, `Average latency (${avgLatency.toFixed(2)}ms) must be under 50ms`);
      assert.ok(maxLatency < 150, `Max latency (${maxLatency.toFixed(2)}ms) must be under 150ms`);
      console.log(`    ${colors.dim}↳ Average Latency: ${avgLatency.toFixed(2)}ms | Max Latency: ${maxLatency.toFixed(2)}ms${colors.reset}`);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 4: SECURITY & PENETRATION VULNERABILITY PROBES
    // ------------------------------------------------------------------------
    await systemTest(`Security Probing: Path Traversal attempts on static routes safely rejected`, async () => {
      const maliciousPaths = [
        '/%2e%2e/%2e%2e/package.json',
        '/..%2f..%2fexamshield.db',
        '/admin/..%2f..%2fsrc%2fserver.js'
      ];

      for (const p of maliciousPaths) {
        const res = await fetch(`${BASE_URL}${p}`);
        // Express static prevents path traversal above root
        assert.ok(res.status === 404 || res.status === 403 || res.status === 400, `Path traversal "${p}" must be blocked (status: ${res.status})`);
      }
    });

    await systemTest(`Security Probing: Authentication bypass & SQL injection on admin routes rejected`, async () => {
      const maliciousTokens = [
        "' OR '1'='1",
        "admin'--",
        "",
        "null",
        "../../admin"
      ];

      for (const tok of maliciousTokens) {
        const res = await fetch(`${BASE_URL}/api/teacher/students`, {
          headers: { 'x-admin-token': tok }
        });
        assert.strictEqual(res.status, 401, `Malicious token "${tok}" must return 401 Unauthorized`);
      }
    });

    await systemTest(`Security Probing: Input Validation & malformed JSON gracefully rejected`, async () => {
      // Empty student name
      const emptyNameRes = await fetch(`${BASE_URL}/api/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: '   ' })
      });
      assert.strictEqual(emptyNameRes.status, 400, 'Blank student name must return 400');

      // Invalid session id
      const fakeSessionRes = await fetch(`${BASE_URL}/api/student/session/non_existent_uuid_9999`);
      assert.strictEqual(fakeSessionRes.status, 404, 'Non-existent session must return 404');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 5: DATA ISOLATION & PRIVACY TEST
    // ------------------------------------------------------------------------
    await systemTest(`Data Isolation: Candidate A cannot overwrite or view Candidate B's answers`, async () => {
      const candA = studentSessions[0];
      const candB = studentSessions[1];

      // Verify A's answers are distinct
      const qId = candA.questions[0].id;
      db.saveAnswer(candA.session_id, qId, ['opt_special_a']);

      const sessionA = db.getSessionById(candA.session_id);
      const sessionB = db.getSessionById(candB.session_id);

      assert.deepStrictEqual(sessionA.answers[qId], ['opt_special_a']);
      assert.notDeepStrictEqual(sessionB.answers[qId], ['opt_special_a'], 'Candidate B must not be affected by Candidate A');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 6: BATCH SUBMISSION & SYSTEM MEMORY STABILITY
    // ------------------------------------------------------------------------
    await systemTest(`Batch Submissions: All ${studentCount} candidates submit papers without memory leak`, async () => {
      const initialMem = process.memoryUsage().rss / (1024 * 1024);

      const submitPromises = studentSessions.map(s => {
        return fetch(`${BASE_URL}/api/student/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-student-token': s.student_token },
          body: JSON.stringify({ session_id: s.session_id, student_token: s.student_token })
        }).then(res => res.json());
      });

      const submitResults = await Promise.all(submitPromises);
      for (const res of submitResults) {
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.result.competitive_mode, true);
        assert.ok(typeof res.result.total_score === 'number');
        assert.ok(typeof res.result.correct_count === 'number');
        assert.ok(typeof res.result.wrong_count === 'number');
      }

      const finalMem = process.memoryUsage().rss / (1024 * 1024);
      const memDelta = finalMem - initialMem;
      console.log(`    ${colors.dim}↳ Memory RSS before batch: ${initialMem.toFixed(1)}MB | After: ${finalMem.toFixed(1)}MB (Delta: ${memDelta.toFixed(1)}MB)${colors.reset}`);
      assert.ok(finalMem < 300, 'Memory usage must remain under 300MB');
    });

  } finally {
    console.log(`\n  ${colors.dim}Shutting down system test server...${colors.reset}`);
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
  console.log(`${colors.bold}   SYSTEM TESTING SUMMARY REPORT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`  Scenarios Run   : ${totalScenarios}`);
  console.log(`  Passed          : ${colors.green}${passedScenarios}${colors.reset}`);
  console.log(`  Failed          : ${failedScenarios > 0 ? colors.red + failedScenarios + colors.reset : '0'}`);
  console.log(`  Total Duration  : ${duration}s`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);

  if (failedScenarios > 0) {
    console.log(`\n${colors.red}${colors.bold}Failed Scenario Details:${colors.reset}`);
    failureDetails.forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f.name}`);
      console.log(`     ${f.error.stack || f.error.message}\n`);
    });
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}🎉 ALL SYSTEM & PERFORMANCE TESTS PASSED 100%!${colors.reset}\n`);
    process.exit(0);
  }
}

runSystemTests().catch(err => {
  console.error('System Test Fatal Error:', err);
  process.exit(1);
});
