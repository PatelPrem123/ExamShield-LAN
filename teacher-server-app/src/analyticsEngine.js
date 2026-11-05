/**
 * ============================================================================
 * EXAMSHIELD LAN - CANDIDATE ANALYTICS & INTEGRITY ENGINE
 * ============================================================================
 * Developed using Test-Driven Development (TDD).
 * Provides deep insights for Competitive Mode, Proctoring Risk, and Cohort Metrics.
 * ============================================================================
 */

/**
 * Computes detailed candidate metrics including Gross, Penalty, and Accuracy rates.
 *
 * @param {Object} input
 * @param {number} input.total_questions
 * @param {number} input.correct_count
 * @param {number} input.wrong_count
 * @param {number} input.unattempted_count
 * @param {boolean} [input.competitive_mode=true]
 * @returns {Object} analytics
 */
function computeCandidateAnalytics(input) {
  const total = Number(input.total_questions) || 0;
  const correct = Number(input.correct_count) || 0;
  const wrong = Number(input.wrong_count) || 0;
  const unattempted = Number(input.unattempted_count) || Math.max(0, total - (correct + wrong));
  const isCompetitive = !!input.competitive_mode;

  const marksPerCorrect = isCompetitive ? 4 : 1;
  const marksPerWrong = isCompetitive ? 1 : 0;

  const grossMarks = correct * marksPerCorrect;
  const penaltyDeducted = wrong * marksPerWrong;
  const netScore = grossMarks - penaltyDeducted;
  const maxPossibleMarks = total * marksPerCorrect;

  const attemptedCount = correct + wrong;
  const attemptRate = total > 0 ? Number(((attemptedCount / total) * 100).toFixed(1)) : 0;
  const accuracyRate = attemptedCount > 0 ? Number(((correct / attemptedCount) * 100).toFixed(1)) : 0;

  const penaltyImpactPercentage = grossMarks > 0
    ? Number(((penaltyDeducted / grossMarks) * 100).toFixed(1))
    : 0;

  return {
    total_questions: total,
    correct_count: correct,
    wrong_count: wrong,
    unattempted_count: unattempted,
    attempted_count: attemptedCount,
    gross_marks: grossMarks,
    penalty_deducted: penaltyDeducted,
    net_score: netScore,
    max_possible_marks: maxPossibleMarks,
    attempt_rate: attemptRate,
    accuracy_rate: accuracyRate,
    penalty_impact_percentage: penaltyImpactPercentage,
    competitive_mode: isCompetitive
  };
}

/**
 * Calculates a Proctoring / Integrity Risk Score (0 to 100) and recommendation level.
 *
 * @param {Object} input
 * @param {number} input.violations_count - Number of focus lost events
 * @param {number} [input.freeze_duration_seconds=0] - Total time in seconds spent in frozen state
 * @param {string} [input.status='submitted'] - Session status
 * @returns {Object} riskAssessment
 */
function computeCheatingRiskScore(input) {
  const violations = Number(input.violations_count) || 0;
  const duration = Number(input.freeze_duration_seconds) || 0;
  const isFrozen = input.status === 'frozen';

  if (violations === 0 && !isFrozen) {
    return {
      score: 0,
      level: 'CLEAN',
      action_required: false,
      summary: 'No focus loss or integrity violations detected.'
    };
  }

  // Base score: 20 points per violation
  let rawScore = violations * 20;

  // Add time factor: 3 points per 15 seconds frozen (up to 15 extra points)
  const durationFactor = Math.min(15, Math.floor(duration / 15) * 3);
  rawScore += durationFactor;

  if (isFrozen) {
    rawScore = Math.max(rawScore, 65); // Currently frozen is at least suspicious
  }

  const score = Math.min(100, Math.max(0, rawScore));

  let level = 'LOW_RISK';
  let actionRequired = false;
  let summary = 'Minor focus anomaly detected (e.g. system notification).';

  if (score >= 80) {
    level = 'CRITICAL';
    actionRequired = true;
    summary = 'Repeated focus loss or prolonged application switching. Manual audit recommended.';
  } else if (score >= 40) {
    level = 'SUSPICIOUS';
    actionRequired = true;
    summary = 'Multiple focus loss incidents observed. Review candidate log.';
  }

  return {
    score,
    level,
    action_required: actionRequired,
    summary,
    violations_count: violations,
    freeze_duration_seconds: duration
  };
}

/**
 * Computes cohort (entire batch/classroom) summary performance metrics.
 *
 * @param {Array<Object>} candidatesList - List of student session objects
 * @returns {Object} cohortMetrics
 */
function computeCohortAnalytics(candidatesList = []) {
  if (!Array.isArray(candidatesList) || candidatesList.length === 0) {
    return {
      total_candidates: 0,
      average_score: 0,
      median_score: 0,
      highest_score: 0,
      lowest_score: 0,
      pass_rate_percentage: 0,
      average_accuracy: 0
    };
  }

  const scores = candidatesList.map(c => Number(c.total_score) || 0).sort((a, b) => a - b);
  const total = candidatesList.length;

  const sumScore = scores.reduce((acc, s) => acc + s, 0);
  const averageScore = Number((sumScore / total).toFixed(1));

  const highestScore = scores[scores.length - 1];
  const lowestScore = scores[0];

  // Median
  const mid = Math.floor(total / 2);
  const medianScore = (total % 2 !== 0)
    ? scores[mid]
    : Number(((scores[mid - 1] + scores[mid]) / 2).toFixed(1));

  // Pass rate
  const passedCount = candidatesList.filter(c => !!c.passed).length;
  const passRatePercentage = Number(((passedCount / total) * 100).toFixed(1));

  // Average accuracy
  let sumAccuracy = 0;
  for (const c of candidatesList) {
    const correct = Number(c.correct_count) || 0;
    const wrong = Number(c.wrong_count) || 0;
    const attempted = correct + wrong;
    if (attempted > 0) {
      sumAccuracy += (correct / attempted) * 100;
    }
  }
  const averageAccuracy = Number((sumAccuracy / total).toFixed(1));

  return {
    total_candidates: total,
    average_score: averageScore,
    median_score: medianScore,
    highest_score: highestScore,
    lowest_score: lowestScore,
    pass_rate_percentage: passRatePercentage,
    average_accuracy: averageAccuracy
  };
}

module.exports = {
  computeCandidateAnalytics,
  computeCheatingRiskScore,
  computeCohortAnalytics
};
