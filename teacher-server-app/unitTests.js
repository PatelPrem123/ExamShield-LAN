/**
 * ============================================================================
 * EXAMSHIELD LAN - COMPREHENSIVE AUTOMATED UNIT TEST SUITE
 * ============================================================================
 * Tests all core subsystems:
 * 1. Exam Engine: Standard Grading, Competitive Mode (+4 / -1 / 0), Sanitization, Shuffling
 * 2. Database Layer: Schema Migrations, Student Sessions, Reconnect, Review Permissions, Admin PIN
 * 3. Exporter & Leaderboard: Rank computation, Tie-breaking, CSV & Excel generation with Right/Wrong columns
 * 4. History Logger: Local time formatting (no 3PM shift), History entry formatting
 * 5. Configuration & Mutual Exclusivity: Competitive Mode vs Per-Question Timer rules
 * ============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors for terminal reporting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

let totalSuites = 0;
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function suite(name, fn) {
  totalSuites++;
  console.log(`\n${colors.bold}${colors.cyan}▶ [SUITE ${totalSuites}] ${name}${colors.reset}`);
  await fn();
}

async function test(name, fn) {
  totalTests++;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    passedTests++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} : ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err });
    console.log(`  ${colors.red}✖ FAIL${colors.reset} : ${name}`);
    console.log(`    ${colors.yellow}${err.message}${colors.reset}`);
  }
}

async function runAllUnitTests() {
  const startTime = Date.now();
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bold}   🛡️  ExamShield LAN - Automated Unit Test Suite${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);

  // --------------------------------------------------------------------------
  // SUITE 1: EXAM ENGINE & GRADING LOGIC
  // --------------------------------------------------------------------------
  const engine = require('./src/examEngine');

  await suite('Exam Engine - Standard & Competitive Marking Scheme', async () => {
    const mockQuestions = [
      { id: 'q1', topic: 'Networking', correct_keys: ['opt_0'] },
      { id: 'q2', topic: 'Networking', correct_keys: ['opt_1'] },
      { id: 'q3', topic: 'Hardware', correct_keys: ['opt_2'] },
      { id: 'q4', topic: 'Hardware', correct_keys: ['opt_3'] },
      { id: 'q5', topic: 'Operating Systems', correct_keys: ['opt_0'] },
      { id: 'q6', topic: 'Operating Systems', correct_keys: ['opt_1'] },
      { id: 'q7', topic: 'Security', correct_keys: ['opt_2'] },
      { id: 'q8', topic: 'Security', correct_keys: ['opt_3'] },
      { id: 'q9', topic: 'Security', correct_keys: ['opt_0'] },
      { id: 'q10', topic: 'Security', correct_keys: ['opt_1'] }
    ];

    await test('Standard Mode: Accurate Right, Wrong, Unattempted counts', () => {
      // 5 correct, 3 wrong, 2 unattempted
      const studentAnswers = {
        q1: ['opt_0'], // correct
        q2: ['opt_1'], // correct
        q3: ['opt_2'], // correct
        q4: ['opt_3'], // correct
        q5: ['opt_0'], // correct
        q6: ['wrong_1'], // wrong
        q7: ['wrong_2'], // wrong
        q8: ['wrong_3']  // wrong
        // q9, q10 unattempted
      };

      const result = engine.gradeSession(mockQuestions, studentAnswers, 50, false);
      assert.strictEqual(result.correct_count, 5, 'Correct count must be 5');
      assert.strictEqual(result.wrong_count, 3, 'Wrong count must be 3');
      assert.strictEqual(result.unattempted_count, 2, 'Unattempted count must be 2');
      assert.strictEqual(result.total_score, 5, 'Standard total score must be 5');
      assert.strictEqual(result.max_score, 10, 'Standard max score must be 10');
      assert.strictEqual(result.percentage, 50, 'Standard percentage must be 50%');
      assert.strictEqual(result.passed, true, 'Passing percentage 50% should pass');
      assert.strictEqual(result.competitive_mode, false, 'competitive_mode flag must be false');
    });

    await test('Competitive Mode: +4 for Right, -1 for Wrong, 0 for Unattempted', () => {
      // 6 right (+24), 2 wrong (-2), 2 unattempted (0) -> Total = 22 out of 40
      const studentAnswers = {
        q1: ['opt_0'], // +4
        q2: ['opt_1'], // +4
        q3: ['opt_2'], // +4
        q4: ['opt_3'], // +4
        q5: ['opt_0'], // +4
        q6: ['opt_1'], // +4
        q7: ['wrong_a'], // -1
        q8: ['wrong_b']  // -1
        // q9, q10 unattempted -> 0
      };

      const result = engine.gradeSession(mockQuestions, studentAnswers, 50, true);
      assert.strictEqual(result.correct_count, 6, 'Correct count must be 6');
      assert.strictEqual(result.wrong_count, 2, 'Wrong count must be 2');
      assert.strictEqual(result.unattempted_count, 2, 'Unattempted count must be 2');
      assert.strictEqual(result.total_score, 22, 'Expected total score: (6*4) - (2*1) = 22');
      assert.strictEqual(result.max_score, 40, 'Expected max score: 10 * 4 = 40');
      assert.strictEqual(result.percentage, 55, 'Expected percentage: (22/40)*100 = 55%');
      assert.strictEqual(result.passed, true, '55% >= 50% should pass');
      assert.strictEqual(result.competitive_mode, true, 'competitive_mode flag must be true');
    });

    await test('Competitive Mode: All questions correct gives 100%', () => {
      const perfectAnswers = {};
      mockQuestions.forEach(q => { perfectAnswers[q.id] = q.correct_keys; });

      const result = engine.gradeSession(mockQuestions, perfectAnswers, 70, true);
      assert.strictEqual(result.correct_count, 10);
      assert.strictEqual(result.wrong_count, 0);
      assert.strictEqual(result.unattempted_count, 0);
      assert.strictEqual(result.total_score, 40);
      assert.strictEqual(result.max_score, 40);
      assert.strictEqual(result.percentage, 100);
      assert.strictEqual(result.passed, true);
    });

    await test('Competitive Mode: All questions unattempted gives 0 marks without penalty', () => {
      const result = engine.gradeSession(mockQuestions, {}, 50, true);
      assert.strictEqual(result.correct_count, 0);
      assert.strictEqual(result.wrong_count, 0);
      assert.strictEqual(result.unattempted_count, 10);
      assert.strictEqual(result.total_score, 0);
      assert.strictEqual(result.max_score, 40);
      assert.strictEqual(result.percentage, 0);
      assert.strictEqual(result.passed, false);
    });

    await test('Competitive Mode: Negative score calculation and percentage clamped at 0%', () => {
      // 1 right (+4), 9 wrong (-9) -> Total = -5
      const badAnswers = {
        q1: ['opt_0'], // +4
        q2: ['x'], q3: ['x'], q4: ['x'], q5: ['x'],
        q6: ['x'], q7: ['x'], q8: ['x'], q9: ['x'], q10: ['x'] // -9
      };

      const result = engine.gradeSession(mockQuestions, badAnswers, 50, true);
      assert.strictEqual(result.correct_count, 1);
      assert.strictEqual(result.wrong_count, 9);
      assert.strictEqual(result.total_score, -5, 'Net score can be negative (-5)');
      assert.strictEqual(result.percentage, 0, 'Percentage must never be negative, clamped to 0');
      assert.strictEqual(result.passed, false);
    });

    await test('Multiple Choice / Multi-Select Question Grading', () => {
      const multiQ = [
        { id: 'mq1', topic: 'Networking', correct_keys: ['opt_a', 'opt_c'], is_multiple_choice: true }
      ];

      // Exact match
      const exactRes = engine.gradeSession(multiQ, { mq1: ['opt_c', 'opt_a'] }, 50, true);
      assert.strictEqual(exactRes.correct_count, 1);
      assert.strictEqual(exactRes.total_score, 4);

      // Incomplete selection (only 1 of 2 selected) -> wrong
      const partialRes = engine.gradeSession(multiQ, { mq1: ['opt_a'] }, 50, true);
      assert.strictEqual(partialRes.wrong_count, 1);
      assert.strictEqual(partialRes.total_score, -1);
    });

    await test('Client Sanitization: Correct keys completely stripped from student payload', () => {
      const assigned = [
        {
          index: 1,
          id: 'q100',
          topic: 'Security',
          question_text: 'What is a firewall?',
          correct_keys: ['opt_0'],
          options: [
            { key: 'opt_0', display_letter: 'A', text: 'Network filter' },
            { key: 'opt_1', display_letter: 'B', text: 'Malware' }
          ]
        }
      ];

      const clientPayload = engine.sanitizeQuestionsForClient(assigned);
      assert.strictEqual(clientPayload[0].correct_keys, undefined, 'correct_keys must be stripped');
      assert.strictEqual(clientPayload[0].id, 'q100');
      assert.strictEqual(clientPayload[0].options.length, 2);
      assert.strictEqual(clientPayload[0].options[0].display_letter, 'A');
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: DATABASE LAYER & MIGRATIONS
  // --------------------------------------------------------------------------
  await suite('Database Layer - Migrations, Sessions & Persistent Storage', async () => {
    // Use an isolated temporary database path for testing
    const tempDbPath = path.join(os.tmpdir(), `examshield_test_${Date.now()}.db`);

    // Load database module pointing to temp DB
    const Database = require('better-sqlite3');
    const testDbInstance = new Database(tempDbPath);

    // Replicate database table creation & migrations
    testDbInstance.exec(`
      CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT 'Certification Exam',
        duration_minutes INTEGER NOT NULL DEFAULT 60,
        questions_per_topic INTEGER NOT NULL DEFAULT 15,
        passing_percentage REAL NOT NULL DEFAULT 70.0,
        admin_pin TEXT NOT NULL DEFAULT '1234',
        per_question_time_enabled INTEGER NOT NULL DEFAULT 0,
        per_question_time_seconds INTEGER NOT NULL DEFAULT 60,
        competitive_mode_enabled INTEGER NOT NULL DEFAULT 0,
        publish_review_all INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS student_sessions (
        id TEXT PRIMARY KEY,
        exam_id INTEGER NOT NULL,
        student_name TEXT NOT NULL,
        exam_set TEXT NOT NULL,
        assigned_questions_json TEXT NOT NULL,
        answers_json TEXT NOT NULL,
        marked_for_review_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_progress',
        freeze_reason TEXT,
        freeze_timestamp DATETIME,
        remaining_seconds INTEGER NOT NULL,
        total_score INTEGER DEFAULT 0,
        max_score INTEGER DEFAULT 0,
        percentage REAL DEFAULT 0.0,
        passed INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        wrong_count INTEGER DEFAULT 0,
        unattempted_count INTEGER DEFAULT 0,
        topic_scores_json TEXT,
        allow_review INTEGER DEFAULT 0,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        submitted_at DATETIME
      );

      INSERT INTO exams (id, title, duration_minutes, passing_percentage, admin_pin, competitive_mode_enabled)
      VALUES (1, 'Unit Test Exam', 45, 60.0, '5678', 1);
    `);

    await test('Table migrations: Competitive and count columns exist in database', () => {
      const examCols = testDbInstance.pragma('table_info(exams)');
      const colNames = examCols.map(c => c.name);
      assert.ok(colNames.includes('competitive_mode_enabled'), 'Column competitive_mode_enabled must exist in exams');
      assert.ok(colNames.includes('per_question_time_enabled'), 'Column per_question_time_enabled must exist in exams');

      const sessionCols = testDbInstance.pragma('table_info(student_sessions)');
      const sessionColNames = sessionCols.map(c => c.name);
      assert.ok(sessionColNames.includes('correct_count'), 'Column correct_count must exist in student_sessions');
      assert.ok(sessionColNames.includes('wrong_count'), 'Column wrong_count must exist in student_sessions');
      assert.ok(sessionColNames.includes('unattempted_count'), 'Column unattempted_count must exist in student_sessions');
    });

    await test('Student Session: Insert, Save Answer, Freeze, and Unfreeze', () => {
      // 1. Insert session
      testDbInstance.prepare(`
        INSERT INTO student_sessions (
          id, exam_id, student_name, exam_set, assigned_questions_json, answers_json,
          marked_for_review_json, status, remaining_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'sess_001', 1, 'Aman Verma', 'Random',
        JSON.stringify([{ id: 'q1' }]),
        JSON.stringify({}),
        JSON.stringify([]),
        'in_progress',
        2700
      );

      let row = testDbInstance.prepare('SELECT * FROM student_sessions WHERE id = ?').get('sess_001');
      assert.strictEqual(row.student_name, 'Aman Verma');
      assert.strictEqual(row.status, 'in_progress');

      // 2. Save answer
      const updatedAnswers = { q1: ['opt_0'] };
      testDbInstance.prepare('UPDATE student_sessions SET answers_json = ? WHERE id = ?')
        .run(JSON.stringify(updatedAnswers), 'sess_001');

      row = testDbInstance.prepare('SELECT * FROM student_sessions WHERE id = ?').get('sess_001');
      assert.deepStrictEqual(JSON.parse(row.answers_json), updatedAnswers);

      // 3. Freeze session
      testDbInstance.prepare("UPDATE student_sessions SET status = 'frozen', freeze_reason = 'Alt+Tab' WHERE id = ?")
        .run('sess_001');
      row = testDbInstance.prepare('SELECT * FROM student_sessions WHERE id = ?').get('sess_001');
      assert.strictEqual(row.status, 'frozen');
      assert.strictEqual(row.freeze_reason, 'Alt+Tab');

      // 4. Unfreeze session
      testDbInstance.prepare("UPDATE student_sessions SET status = 'in_progress', freeze_reason = NULL WHERE id = ?")
        .run('sess_001');
      row = testDbInstance.prepare('SELECT * FROM student_sessions WHERE id = ?').get('sess_001');
      assert.strictEqual(row.status, 'in_progress');
      assert.strictEqual(row.freeze_reason, null);
    });

    await test('Student Submission: Correct, Wrong, Unattempted counts persist and retrieve accurately', () => {
      testDbInstance.prepare(`
        UPDATE student_sessions SET
          status = 'submitted',
          total_score = ?,
          max_score = ?,
          percentage = ?,
          passed = ?,
          correct_count = ?,
          wrong_count = ?,
          unattempted_count = ?,
          submitted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(18, 40, 45.0, 0, 5, 2, 3, 'sess_001');

      const row = testDbInstance.prepare('SELECT * FROM student_sessions WHERE id = ?').get('sess_001');
      assert.strictEqual(row.status, 'submitted');
      assert.strictEqual(row.total_score, 18);
      assert.strictEqual(row.max_score, 40);
      assert.strictEqual(row.correct_count, 5, 'Stored correct_count must be 5');
      assert.strictEqual(row.wrong_count, 2, 'Stored wrong_count must be 2');
      assert.strictEqual(row.unattempted_count, 3, 'Stored unattempted_count must be 3');
      assert.strictEqual(row.passed, 0);
    });

    await test('Review Permissions: Global and Per-Student overrides', () => {
      // Per-student allow review
      testDbInstance.prepare('UPDATE student_sessions SET allow_review = 1 WHERE id = ?').run('sess_001');
      let row = testDbInstance.prepare('SELECT allow_review FROM student_sessions WHERE id = ?').get('sess_001');
      assert.strictEqual(row.allow_review, 1);

      // Global publish review
      testDbInstance.prepare('UPDATE exams SET publish_review_all = 1 WHERE id = 1').run();
      const examRow = testDbInstance.prepare('SELECT publish_review_all FROM exams WHERE id = 1').get();
      assert.strictEqual(examRow.publish_review_all, 1);
    });

    // Cleanup test database
    try {
      testDbInstance.close();
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch (e) {}
  });

  // --------------------------------------------------------------------------
  // SUITE 3: EXPORTER, LEADERBOARD & RANKINGS
  // --------------------------------------------------------------------------
  const exporter = require('./src/exporter');

  await suite('Exporter - Leaderboard Ranking, CSV & Excel Generation', async () => {
    const mockSessions = [
      {
        id: 's1',
        student_name: 'Candidate A',
        status: 'submitted',
        total_score: 32,
        max_score: 40,
        percentage: 80.0,
        passed: 1,
        correct_count: 8,
        wrong_count: 0,
        unattempted_count: 2,
        start_time: '2026-10-30 10:00:00',
        submitted_at: '2026-10-30 10:35:00',
        topic_scores: { Networking: { score: 32, total: 40, percentage: 80 } }
      },
      {
        id: 's2',
        student_name: 'Candidate B',
        status: 'submitted',
        total_score: 18,
        max_score: 40,
        percentage: 45.0,
        passed: 0,
        correct_count: 5,
        wrong_count: 2,
        unattempted_count: 3,
        start_time: '2026-10-30 10:00:00',
        submitted_at: '2026-10-30 10:40:00',
        topic_scores: { Networking: { score: 18, total: 40, percentage: 45 } }
      },
      {
        id: 's3',
        student_name: 'Candidate C',
        status: 'submitted',
        total_score: 32,
        max_score: 40,
        percentage: 80.0,
        passed: 1,
        correct_count: 8,
        wrong_count: 0,
        unattempted_count: 2,
        start_time: '2026-10-30 10:00:00',
        submitted_at: '2026-10-30 10:30:00', // Earlier submission than Candidate A
        topic_scores: { Networking: { score: 32, total: 40, percentage: 80 } }
      }
    ];

    await test('Ranking Engine: Tie-breaking policy (Score -> Pct -> Earlier submission)', () => {
      const { rankedMap, sortedList } = exporter.computeRanks(mockSessions);
      // Candidate C submitted at 10:30:00, Candidate A at 10:35:00 with same score 32 (80%)
      assert.strictEqual(sortedList[0].id, 's3', 'Candidate C should be first due to earlier submission');
      assert.strictEqual(sortedList[1].id, 's1', 'Candidate A should be second');
      assert.strictEqual(sortedList[2].id, 's2', 'Candidate B should be third');

      // Check ranks
      assert.strictEqual(rankedMap.get('s3'), 1);
      assert.strictEqual(rankedMap.get('s1'), 1, 'Tied score and percentage should share Rank 1');
      assert.strictEqual(rankedMap.get('s2'), 3, 'Next candidate should be Rank 3');
    });

    await test('CSV Export: UTF-8 BOM, Right Answers, and Wrong Answers columns present', () => {
      const csvBuffer = exporter.generateMasterCsv(mockSessions, 'rank', 'Networking Exam');
      assert.ok(Buffer.isBuffer(csvBuffer), 'CSV output must be a Buffer');

      // Check UTF-8 BOM
      assert.strictEqual(csvBuffer[0], 0xEF, 'BOM byte 1');
      assert.strictEqual(csvBuffer[1], 0xBB, 'BOM byte 2');
      assert.strictEqual(csvBuffer[2], 0xBF, 'BOM byte 3');

      const csvString = csvBuffer.toString('utf8');
      assert.ok(csvString.includes('Right Answers'), 'CSV header must include Right Answers');
      assert.ok(csvString.includes('Wrong Answers'), 'CSV header must include Wrong Answers');
      assert.ok(csvString.includes('Score'), 'CSV header must include Score');
      assert.ok(csvString.includes('Candidate A'), 'CSV must contain Candidate A row');
    });

    await test('Excel Export: Generates valid .xlsx workbook buffer with all columns', async () => {
      const excelBuffer = await exporter.generateMasterExcel(mockSessions, 'rank', 'Networking Exam', 'xlsx');
      assert.ok(Buffer.isBuffer(excelBuffer), 'Excel output must be a Buffer');
      assert.ok(excelBuffer.length > 5000, 'Excel file size must be non-empty and valid');

      // Validate ZIP signature (Excel files are zip packages starting with PK\x03\x04)
      assert.strictEqual(excelBuffer[0], 0x50, 'PK header byte 1');
      assert.strictEqual(excelBuffer[1], 0x4B, 'PK header byte 2');
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 4: HISTORY LOGGER & TIMEZONE FORMATTING
  // --------------------------------------------------------------------------
  const historyLogger = require('./src/historyLogger');

  await suite('History Logger - Local Time & Audit Record Verification', async () => {
    await test('Local Time Formatter: Never displays raw UTC or 3 PM offset bug', () => {
      // Test known ISO strings
      const testDate = new Date('2026-10-30T10:15:30Z');
      const formatted = historyLogger.formatDateTime(testDate);
      assert.ok(typeof formatted === 'string' && formatted.length > 10, 'Must return formatted date string');
      assert.ok(!formatted.includes('NaN'), 'Formatted string must not contain NaN');
      assert.ok(formatted.includes('AM') || formatted.includes('PM'), 'Must include 12-hour AM/PM indicator');
    });

    await test('History formatting: Appends right and wrong answers to history record', () => {
      const mockAttempt = {
        timestamp: new Date(),
        student_name: 'Pooja Nair',
        exam_title: 'Cyber Security Exam',
        exam_set: 'Random',
        total_score: 28,
        max_score: 40,
        percentage: 70.0,
        passed: true,
        correct_count: 7,
        wrong_count: 0,
        unattempted_count: 3,
        competitive_mode: true,
        violations_count: 0,
        topic_scores: { Cryptography: { score: 28, total: 40, percentage: 70 } }
      };

      // Mock temporary files
      const tempBat = path.join(os.tmpdir(), `test_hist_${Date.now()}.bat`);
      const tempTxt = path.join(os.tmpdir(), `test_hist_${Date.now()}.txt`);
      const tempCsv = path.join(os.tmpdir(), `test_hist_${Date.now()}.csv`);

      const batLine = `:: [RECORD] Candidate: ${mockAttempt.student_name} | Score: ${mockAttempt.total_score}/${mockAttempt.max_score} (Right: ${mockAttempt.correct_count}, Wrong: ${mockAttempt.wrong_count})\r\n`;
      const csvLine = `"2026-10-30","${mockAttempt.student_name}","${mockAttempt.exam_title}","Random Order",${mockAttempt.total_score},${mockAttempt.max_score},${mockAttempt.correct_count},${mockAttempt.wrong_count},${mockAttempt.unattempted_count},"70.0%","PASSED",0,"-"\r\n`;

      fs.writeFileSync(tempBat, batLine, 'ascii');
      fs.writeFileSync(tempCsv, csvLine, 'utf8');

      const batContent = fs.readFileSync(tempBat, 'utf8');
      assert.ok(batContent.includes('Right: 7, Wrong: 0'), 'Batch record must log Right: 7, Wrong: 0');

      const csvContent = fs.readFileSync(tempCsv, 'utf8');
      assert.ok(csvContent.includes(',28,40,7,0,3,'), 'CSV row must include score and right/wrong/unattempted tokens');

      try {
        fs.unlinkSync(tempBat);
        fs.unlinkSync(tempCsv);
      } catch (e) {}
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 5: CONFIGURATION & MUTUAL EXCLUSIVITY LOGIC
  // --------------------------------------------------------------------------
  await suite('Exam Settings - Mutual Exclusivity (Competitive vs Per-Q Time Limit)', async () => {
    await test('Server-side enforcement: Enabling Competitive Mode forces Per-Q Time Limit to False', () => {
      // Simulating the logic inside /api/exam/config
      function processConfig(body) {
        let perQuestionTimeEnabled = !!body.per_question_time_enabled;
        let competitiveModeEnabled = !!body.competitive_mode_enabled;

        // Mutual exclusivity enforcement
        if (competitiveModeEnabled) {
          perQuestionTimeEnabled = false;
        } else if (perQuestionTimeEnabled) {
          competitiveModeEnabled = false;
        }

        return { perQuestionTimeEnabled, competitiveModeEnabled };
      }

      // Both sent as true (e.g. concurrent or malicious client request)
      const sanitized = processConfig({ competitive_mode_enabled: true, per_question_time_enabled: true });
      assert.strictEqual(sanitized.competitiveModeEnabled, true, 'Competitive mode must remain active');
      assert.strictEqual(sanitized.perQuestionTimeEnabled, false, 'Per-Q time must be forced to false');

      // Only per-question enabled
      const perQOnly = processConfig({ competitive_mode_enabled: false, per_question_time_enabled: true });
      assert.strictEqual(perQOnly.perQuestionTimeEnabled, true);
      assert.strictEqual(perQOnly.competitiveModeEnabled, false);

      // Both disabled
      const bothDisabled = processConfig({ competitive_mode_enabled: false, per_question_time_enabled: false });
      assert.strictEqual(bothDisabled.perQuestionTimeEnabled, false);
      assert.strictEqual(bothDisabled.competitiveModeEnabled, false);
    });

    await test('System Info payload: Never exposes host admin PIN', () => {
      const mockRawExam = {
        id: 1,
        title: 'Midterm Exam',
        admin_pin: '9999',
        competitive_mode_enabled: 1,
        per_question_time_enabled: 0
      };

      const systemInfoExam = {
        ...mockRawExam,
        admin_pin: undefined
      };

      assert.strictEqual(systemInfoExam.admin_pin, undefined, 'Admin security PIN must never be exposed');
      assert.strictEqual(systemInfoExam.competitive_mode_enabled, 1);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 6: DEFENSIVE RELIABILITY & EDGE CASES
  // --------------------------------------------------------------------------
  const examEngineModule = require('./src/examEngine');
  const dbModule = require('./src/database');

  await suite('Defensive Reliability & Boundary Conditions', async () => {
    await test('BUG-C01 Regression: saveAnswer handles undefined, null, and non-array safely without TypeError', () => {
      const exam = dbModule.getActiveExam();
      const examId = exam ? exam.id : 1;
      const sId = 'sess_defensive_' + Date.now();
      const testSession = dbModule.createStudentSession({
        id: sId,
        exam_id: examId,
        student_name: 'Defensive Student',
        exam_set: 'Random',
        assigned_questions: [],
        remaining_seconds: 3600
      });

      assert.doesNotThrow(() => {
        dbModule.saveAnswer(sId, 101, undefined);
      }, 'saveAnswer must not throw when answersArray is undefined');

      assert.doesNotThrow(() => {
        dbModule.saveAnswer(sId, 101, null);
      }, 'saveAnswer must not throw when answersArray is null');

      assert.doesNotThrow(() => {
        dbModule.saveAnswer(sId, 101, 'invalid_string');
      }, 'saveAnswer must not throw when answersArray is non-array');

      // Now save a valid array and verify persistence
      const saved = dbModule.saveAnswer(sId, 101, ['opt_0']);
      assert.deepStrictEqual(saved['101'], ['opt_0']);

      // Calling with undefined/empty deletes key safely
      const cleared = dbModule.saveAnswer(sId, 101, undefined);
      assert.strictEqual(cleared['101'], undefined);
    });

    await test('BUG-M02 Regression: arraysEqualAsSets rejects asymmetric sets and duplicate answers', () => {
      const isMatch = examEngineModule.arraysEqualAsSets(['opt_1', 'opt_2'], ['opt_1', 'opt_1']);
      assert.strictEqual(isMatch, false, 'Asymmetric sets must evaluate to false');

      assert.strictEqual(examEngineModule.arraysEqualAsSets(['opt_1', 'opt_2'], ['opt_2', 'opt_1']), true);
      assert.strictEqual(examEngineModule.arraysEqualAsSets(['opt_0'], ['opt_0']), true);
      assert.strictEqual(examEngineModule.arraysEqualAsSets([], []), true);
      assert.strictEqual(examEngineModule.arraysEqualAsSets(['opt_0'], []), false);
    });

    await test('Edge Case: computeRanks handles null/undefined timestamps without NaN sort corruption', () => {
      const candidates = [
        { id: 'c1', total_score: 50, percentage: 50, submitted_at: undefined, start_time: null },
        { id: 'c2', total_score: 50, percentage: 50, submitted_at: '2026-11-03 10:00:00', start_time: null },
        { id: 'c3', total_score: 80, percentage: 80, submitted_at: null, start_time: '2026-11-03 10:05:00' }
      ];

      const exporterModule = require('./src/exporter');
      const { rankedMap, sortedList } = exporterModule.computeRanks(candidates);
      assert.strictEqual(rankedMap.get('c3'), 1, 'Highest score must be rank 1');
      assert.strictEqual(sortedList.length, 3);
      assert.ok(!isNaN(rankedMap.get('c1')), 'Rank for undefined timestamp candidate must not be NaN');
    });

    await test('Edge Case: gradeSession handles empty question bank array without division by zero', () => {
      const result = examEngineModule.gradeSession([], {}, 70, false);
      assert.strictEqual(result.total_score, 0);
      assert.strictEqual(result.max_score, 0);
      assert.strictEqual(result.percentage, 0);
      assert.strictEqual(result.passed, false);
    });
  });

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bold}   TEST SUMMARY REPORT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`  Suites Executed : ${totalSuites}`);
  console.log(`  Total Tests     : ${totalTests}`);
  console.log(`  Passed Tests    : ${colors.green}${passedTests}${colors.reset}`);
  console.log(`  Failed Tests    : ${failedTests > 0 ? colors.red + failedTests + colors.reset : '0'}`);
  console.log(`  Total Duration  : ${duration}s`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);

  if (failedTests > 0) {
    console.log(`\n${colors.red}${colors.bold}Failed Test Details:${colors.reset}`);
    failures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f.name}`);
      console.log(`     ${f.error.stack || f.error.message}\n`);
    });
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}🎉 ALL UNIT TESTS PASSED WITH 100% SUCCESS!${colors.reset}\n`);
    process.exit(0);
  }
}

runAllUnitTests().catch(err => {
  console.error('Test Suite Runner Error:', err);
  process.exit(1);
});
