/**
 * ============================================================================
 * EXAMSHIELD LAN - TEST-DRIVEN DEVELOPMENT (TDD) SUITE
 * ============================================================================
 * Follows the strict Red -> Green -> Refactor cycle:
 *
 * SPECIFICATION: Advanced Candidate Analytics & Proctoring Risk Engine
 * Module to develop: `src/analyticsEngine.js`
 *
 * Capabilities specified:
 * 1. computeCandidateAnalytics(scoreData, options):
 *    - Gross marks earned from correct answers
 *    - Penalty deducted from wrong answers
 *    - Net score calculation
 *    - Accuracy rate percentage (safely handles zero attempted)
 *    - Attempt rate percentage
 *    - Negative marking efficiency index
 *
 * 2. computeCheatingRiskScore(violationsCount, freezeDurationSeconds, status):
 *    - Calculates risk score (0 to 100)
 *    - Maps to Risk Level: 'CLEAN', 'LOW_RISK', 'SUSPICIOUS', 'CRITICAL'
 *    - Flag for proctor intervention recommendation
 *
 * 3. computeCohortAnalytics(candidatesList):
 *    - Cohort average, highest score, lowest score, median score
 *    - Overall cohort accuracy
 *    - Pass rate percentage
 * ============================================================================
 */

const assert = require('assert');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

let tddSuites = 0;
let tddTests = 0;
let tddPassed = 0;
let tddFailed = 0;
const tddFailures = [];

async function suite(name, fn) {
  tddSuites++;
  console.log(`\n${colors.bold}${colors.cyan}▶ [TDD SUITE ${tddSuites}] ${name}${colors.reset}`);
  await fn();
}

async function test(name, fn) {
  tddTests++;
  try {
    await fn();
    tddPassed++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} : ${name}`);
  } catch (err) {
    tddFailed++;
    tddFailures.push({ name, error: err });
    console.log(`  ${colors.red}✖ FAIL${colors.reset} : ${name}`);
    console.log(`    ${colors.yellow}${err.message}${colors.reset}`);
  }
}

async function runTDD() {
  const startTime = Date.now();
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bold}   🛡️  ExamShield LAN - Test-Driven Development (TDD) Runner${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);

  let analytics;
  try {
    analytics = require('./src/analyticsEngine');
  } catch (e) {
    // Expected during initial RED phase before module exists
    analytics = null;
  }

  // --------------------------------------------------------------------------
  // TDD SUITE 1: CANDIDATE PERFORMANCE & NEGATIVE MARKING ANALYTICS
  // --------------------------------------------------------------------------
  await suite('Specification 1: Candidate Performance & Penalty Analytics', async () => {
    await test('Module src/analyticsEngine must exist and export required functions', () => {
      assert.ok(analytics !== null, 'src/analyticsEngine.js must be created');
      assert.strictEqual(typeof analytics.computeCandidateAnalytics, 'function', 'computeCandidateAnalytics must be a function');
      assert.strictEqual(typeof analytics.computeCheatingRiskScore, 'function', 'computeCheatingRiskScore must be a function');
      assert.strictEqual(typeof analytics.computeCohortAnalytics, 'function', 'computeCohortAnalytics must be a function');
    });

    await test('computeCandidateAnalytics calculates Gross, Penalty, Net & Accuracy correctly', () => {
      // 10 questions total: 6 right, 2 wrong, 2 skipped (+4 / -1 scheme)
      const input = {
        total_questions: 10,
        correct_count: 6,
        wrong_count: 2,
        unattempted_count: 2,
        competitive_mode: true
      };

      const result = analytics.computeCandidateAnalytics(input);

      assert.strictEqual(result.gross_marks, 24, 'Gross marks: 6 * 4 = 24');
      assert.strictEqual(result.penalty_deducted, 2, 'Penalty: 2 * 1 = 2');
      assert.strictEqual(result.net_score, 22, 'Net score: 24 - 2 = 22');
      assert.strictEqual(result.max_possible_marks, 40, 'Max marks: 10 * 4 = 40');
      assert.strictEqual(result.attempted_count, 8, 'Attempted: 6 + 2 = 8');
      assert.strictEqual(result.attempt_rate, 80.0, 'Attempt rate: (8/10)*100 = 80%');
      assert.strictEqual(result.accuracy_rate, 75.0, 'Accuracy: (6/8)*100 = 75%');
      assert.strictEqual(result.penalty_impact_percentage, 8.3, 'Penalty impact on gross: (2/24)*100 = 8.3%');
    });

    await test('computeCandidateAnalytics handles zero attempted without NaN or division by zero', () => {
      const input = {
        total_questions: 10,
        correct_count: 0,
        wrong_count: 0,
        unattempted_count: 10,
        competitive_mode: true
      };

      const result = analytics.computeCandidateAnalytics(input);
      assert.strictEqual(result.gross_marks, 0);
      assert.strictEqual(result.penalty_deducted, 0);
      assert.strictEqual(result.net_score, 0);
      assert.strictEqual(result.attempt_rate, 0);
      assert.strictEqual(result.accuracy_rate, 0, 'Accuracy rate must be 0% not NaN');
      assert.strictEqual(result.penalty_impact_percentage, 0);
    });

    await test('computeCandidateAnalytics supports Standard Mode (+1 / 0 scheme)', () => {
      const input = {
        total_questions: 10,
        correct_count: 7,
        wrong_count: 3,
        unattempted_count: 0,
        competitive_mode: false
      };

      const result = analytics.computeCandidateAnalytics(input);
      assert.strictEqual(result.gross_marks, 7);
      assert.strictEqual(result.penalty_deducted, 0, 'Standard mode has 0 penalty');
      assert.strictEqual(result.net_score, 7);
      assert.strictEqual(result.accuracy_rate, 70.0);
    });
  });

  // --------------------------------------------------------------------------
  // TDD SUITE 2: PROCTORING & INTEGRITY RISK ENGINE
  // --------------------------------------------------------------------------
  await suite('Specification 2: Proctoring & Integrity Risk Engine', async () => {
    await test('Zero violations evaluates to CLEAN risk rating', () => {
      const risk = analytics.computeCheatingRiskScore({
        violations_count: 0,
        freeze_duration_seconds: 0,
        status: 'submitted'
      });

      assert.strictEqual(risk.score, 0);
      assert.strictEqual(risk.level, 'CLEAN');
      assert.strictEqual(risk.action_required, false);
    });

    await test('1 minor violation evaluates to LOW_RISK with warning flag', () => {
      const risk = analytics.computeCheatingRiskScore({
        violations_count: 1,
        freeze_duration_seconds: 15,
        status: 'submitted'
      });

      assert.ok(risk.score >= 20 && risk.score <= 35, 'Risk score between 20 and 35');
      assert.strictEqual(risk.level, 'LOW_RISK');
      assert.strictEqual(risk.action_required, false);
    });

    await test('2 to 3 violations evaluate to SUSPICIOUS requiring review', () => {
      const risk = analytics.computeCheatingRiskScore({
        violations_count: 3,
        freeze_duration_seconds: 60,
        status: 'submitted'
      });

      assert.ok(risk.score >= 60 && risk.score < 80);
      assert.strictEqual(risk.level, 'SUSPICIOUS');
      assert.strictEqual(risk.action_required, true);
    });

    await test('4+ violations or prolonged freeze evaluates to CRITICAL flag', () => {
      const risk = analytics.computeCheatingRiskScore({
        violations_count: 5,
        freeze_duration_seconds: 180,
        status: 'frozen'
      });

      assert.ok(risk.score >= 80);
      assert.strictEqual(risk.level, 'CRITICAL');
      assert.strictEqual(risk.action_required, true);
    });
  });

  // --------------------------------------------------------------------------
  // TDD SUITE 3: COHORT (CLASSROOM) AGGREGATE ANALYTICS
  // --------------------------------------------------------------------------
  await suite('Specification 3: Cohort Aggregate Analytics', async () => {
    await test('computeCohortAnalytics calculates accurate mean, median, max, min and pass rate', () => {
      const mockCandidates = [
        { total_score: 36, max_score: 40, passed: 1, correct_count: 9, wrong_count: 0 },
        { total_score: 28, max_score: 40, passed: 1, correct_count: 7, wrong_count: 0 },
        { total_score: 20, max_score: 40, passed: 1, correct_count: 5, wrong_count: 0 },
        { total_score: 12, max_score: 40, passed: 0, correct_count: 4, wrong_count: 4 },
        { total_score: 4,  max_score: 40, passed: 0, correct_count: 2, wrong_count: 4 }
      ];

      const cohort = analytics.computeCohortAnalytics(mockCandidates);
      assert.strictEqual(cohort.total_candidates, 5);
      assert.strictEqual(cohort.highest_score, 36);
      assert.strictEqual(cohort.lowest_score, 4);
      assert.strictEqual(cohort.average_score, 20.0, 'Mean score: (36+28+20+12+4)/5 = 20.0');
      assert.strictEqual(cohort.median_score, 20, 'Median score: 20');
      assert.strictEqual(cohort.pass_rate_percentage, 60.0, 'Pass rate: 3/5 = 60%');
      assert.ok(typeof cohort.average_accuracy === 'number');
    });

    await test('computeCohortAnalytics handles empty candidate list gracefully', () => {
      const cohort = analytics.computeCohortAnalytics([]);
      assert.strictEqual(cohort.total_candidates, 0);
      assert.strictEqual(cohort.average_score, 0);
      assert.strictEqual(cohort.highest_score, 0);
      assert.strictEqual(cohort.lowest_score, 0);
      assert.strictEqual(cohort.pass_rate_percentage, 0);
    });
  });

  // --------------------------------------------------------------------------
  // TDD SUMMARY
  // --------------------------------------------------------------------------
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bold}   TDD CYCLE REPORT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`  Suites Executed : ${tddSuites}`);
  console.log(`  Tests Run       : ${tddTests}`);
  console.log(`  Passed (Green)  : ${colors.green}${tddPassed}${colors.reset}`);
  console.log(`  Failed (Red)    : ${tddFailed > 0 ? colors.red + tddFailed + colors.reset : '0'}`);
  console.log(`  Duration        : ${duration}s`);
  console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);

  if (tddFailed > 0) {
    console.log(`\n${colors.red}${colors.bold}🔴 [PHASE 1: RED] Tests failing as expected before implementation:${colors.reset}`);
    tddFailures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f.name}`);
      console.log(`     ${f.error.message}\n`);
    });
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}🟢 [PHASE 2: GREEN] All TDD specifications satisfied!${colors.reset}\n`);
    process.exit(0);
  }
}

runTDD().catch(err => {
  console.error('TDD Runner Error:', err);
  process.exit(1);
});
