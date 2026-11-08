/**
 * ============================================================================
 * EXAMSHIELD LAN - STUDENT EXAMINATION API ROUTES
 * ============================================================================
 * Handles candidate lifecycle:
 * - /api/system/info          : Sanitized exam rules, timing & host configuration
 * - /api/student/register     : Candidate onboarding, batching & paper allocation
 * - /api/student/session/:id  : Session state recovery & reconnect
 * - /api/student/review/:id   : Post-exam answer key and solution access
 * - /api/student/submit       : Final submission, auto-grading & score persistence
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database');
const {
  getRandomExamSet,
  generateStudentQuestionPool,
  sanitizeQuestionsForClient,
  gradeSession
} = require('../examEngine');
const { computeCandidateAnalytics } = require('../analyticsEngine');
const { getLocalIpAddress } = require('../utils/networkUtils');
const historyLogger = require('../historyLogger');
const { verifyStudentAuth, studentBodySizeGuard, asyncHandler } = require('../middleware/auth');

/**
 * GET /api/system/info
 * Returns sanitized exam configuration and host metadata.
 * Strips admin PIN and private server internals.
 */
router.get('/system/info', asyncHandler(async (req, res) => {
  const localIp = getLocalIpAddress();
  const exam = db.getActiveExam();
  if (!exam) {
    return res.status(404).json({ success: false, error: 'No active exam configured' });
  }

  const topics = db.getTopicsSummary(exam.id);
  const totalQuestions = topics.reduce((acc, t) => acc + t.count, 0);
  const activeBatch = db.getActiveBatchCode(exam.id);
  const batchStatus = db.getBatchExamStatus ? db.getBatchExamStatus(activeBatch) : 'not_started';
  const waitingCount = db.getWaitingStudentsCount ? db.getWaitingStudentsCount(activeBatch) : 0;
  const port = (req.socket && req.socket.localPort) || Number(process.env.PORT) || 3000;

  res.json({
    success: true,
    host_ip: localIp,
    port: port,
    admin_url: `http://${localIp}:${port}/admin`,
    student_url: `http://${localIp}:${port}`,
    active_batch: activeBatch,
    exam_status: batchStatus,
    waiting_count: waitingCount,
    exam: {
      ...exam,
      active_batch_code: activeBatch,
      exam_status: batchStatus,
      waiting_count: waitingCount,
      admin_pin: undefined,
      total_questions_in_pool: totalQuestions,
      topics
    }
  });
}));

/**
 * POST /api/student/register
 * Registers a new candidate, allocates randomized question paper,
 * and issues a private cryptographic session token.
 */
router.post('/student/register', asyncHandler(async (req, res) => {
  const { student_name } = req.body;
  if (!student_name || typeof student_name !== 'string' || !student_name.trim()) {
    return res.status(400).json({ success: false, error: 'Student name is required.' });
  }

  // Comprehensive Sanitization: Strip HTML tags to eliminate Stored XSS
  const cleanName = student_name
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n\t]/g, ' ')
    .trim()
    .substring(0, 100);

  if (!cleanName) {
    return res.status(400).json({
      success: false,
      error: 'Valid candidate name required (cannot consist solely of HTML tags).'
    });
  }

  const exam = db.getActiveExam();
  if (!exam) {
    return res.status(404).json({ success: false, error: 'No active exam configured.' });
  }

  const activeBatch = req.body.batch_code ? req.body.batch_code.trim().toUpperCase() : db.getActiveBatchCode(exam ? exam.id : null);
  const batchExamStatus = db.getBatchExamStatus ? db.getBatchExamStatus(activeBatch) : 'active';

  if (batchExamStatus === 'ended') {
    return res.status(403).json({
      success: false,
      error: 'The examination has already concluded for this batch. New registrations are closed.',
      exam_status: 'ended'
    });
  }

  // Check if session already exists for this student in the active batch
  const existing = db.findActiveSessionByName(exam.id, cleanName, activeBatch);
  if (existing) {
    if (existing.status === 'submitted') {
      const isAllowed = db.isReviewAllowed(existing.id);
      const scoreData = gradeSession(
        existing.assigned_questions,
        existing.answers,
        exam.passing_percentage,
        !!exam.competitive_mode_enabled
      );

      let timeSpentStr = null;
      if (existing.start_time && existing.submitted_at) {
        const start = new Date(existing.start_time).getTime();
        const end = new Date(existing.submitted_at).getTime();
        const diffSeconds = Math.max(0, Math.floor((end - start) / 1000));
        const m = Math.floor(diffSeconds / 60);
        const s = diffSeconds % 60;
        timeSpentStr = `${m}m ${s < 10 ? '0' : ''}${s}s`;
      } else if (existing.remaining_seconds !== undefined && exam.duration_minutes) {
        const totalSec = exam.duration_minutes * 60;
        const diffSeconds = Math.max(0, totalSec - existing.remaining_seconds);
        if (diffSeconds > 0 && diffSeconds < totalSec) {
          const m = Math.floor(diffSeconds / 60);
          const s = diffSeconds % 60;
          timeSpentStr = `${m}m ${s < 10 ? '0' : ''}${s}s`;
        }
      }

      const resultPayload = {
        total_score: existing.total_score,
        max_score: existing.max_score,
        percentage: existing.percentage,
        passed: existing.passed,
        time_spent: timeSpentStr,
        correct_count: existing.correct_count ?? scoreData.correct_count,
        wrong_count: existing.wrong_count ?? scoreData.wrong_count,
        unattempted_count: existing.unattempted_count ?? scoreData.unattempted_count,
        violations: existing.violations_count ?? 0,
        violations_count: existing.violations_count ?? 0,
        violations_history: existing.violations_history || [],
        competitive_mode: !!exam.competitive_mode_enabled,
        analytics: computeCandidateAnalytics({
          total_questions: existing.assigned_questions ? existing.assigned_questions.length : 0,
          correct_count: existing.correct_count ?? scoreData.correct_count,
          wrong_count: existing.wrong_count ?? scoreData.wrong_count,
          unattempted_count: existing.unattempted_count ?? scoreData.unattempted_count,
          competitive_mode: !!exam.competitive_mode_enabled
        }),
        topic_scores: existing.topic_scores,
        allow_review: isAllowed,
        review_questions: isAllowed ? scoreData.review_questions : null
      };

      return res.json({
      success: true,
      is_reconnect: true,
      is_waiting: !!existing.is_waiting,
      exam_status: batchExamStatus,
      session_id: existing.id,
        student_token: existing.auth_token,
        auth_token: existing.auth_token,
        batch_code: existing.batch_code || activeBatch,
        student_name: existing.student_name,
        exam_set: existing.exam_set,
        exam_title: exam.title,
        status: 'submitted',
        result: resultPayload,
        score_data: resultPayload
      });
    }

    // Student is reconnecting or recovering an in-progress exam
    const isWaiting = (batchExamStatus === 'not_started') || (existing.is_waiting === 1);
    const sanitizedQuestions = sanitizeQuestionsForClient(existing.assigned_questions);
    db.addAuditLog(cleanName, 'RECONNECTION', `Student reconnected to session ${existing.id} in batch ${existing.batch_code}`);

    return res.json({
      success: true,
      is_reconnect: true,
      is_waiting: isWaiting,
      exam_status: batchExamStatus,
      session_id: existing.id,
      student_token: existing.auth_token,
      auth_token: existing.auth_token,
      batch_code: existing.batch_code || activeBatch,
      student_name: existing.student_name,
      exam_set: existing.exam_set,
      exam_title: exam.title,
      duration_minutes: exam.duration_minutes,
      remaining_seconds: existing.remaining_seconds,
      per_question_time_enabled: !!exam.per_question_time_enabled,
      per_question_time_seconds: exam.per_question_time_seconds || 60,
      competitive_mode_enabled: !!exam.competitive_mode_enabled,
      status: isWaiting ? 'waiting' : existing.status,
      freeze_reason: existing.freeze_reason,
      violations: existing.violations_count ?? 0,
      violations_count: existing.violations_count ?? 0,
      violations_history: existing.violations_history || [],
      answers: existing.answers,
      marked_for_review: existing.marked_for_review,
      questions: sanitizedQuestions,
      assigned_questions: sanitizedQuestions,
      exam: {
        title: exam.title,
        duration_minutes: exam.duration_minutes,
        passing_percentage: exam.passing_percentage,
        per_question_time_enabled: !!exam.per_question_time_enabled,
        per_question_time_seconds: exam.per_question_time_seconds || 60,
        competitive_mode_enabled: !!exam.competitive_mode_enabled
      }
    });
  }

  // Create new exam attempt
  const allQuestions = db.getQuestionsByExam(exam.id);
  if (allQuestions.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Question bank is empty. Please ask the teacher to upload questions.'
    });
  }

  const assignedQuestions = generateStudentQuestionPool(allQuestions, exam.questions_per_topic || 15);
  const examSet = getRandomExamSet();
  const sessionId = 's_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const authToken = crypto.randomBytes(24).toString('hex');
  const durationSeconds = (exam.duration_minutes || 60) * 60;

  const newSession = db.createStudentSession({
    id: sessionId,
    exam_id: exam.id,
    student_name: cleanName,
    batch_code: activeBatch,
    exam_set: examSet,
    assigned_questions: assignedQuestions,
    answers: {},
    marked_for_review: [],
    status: (batchExamStatus === 'not_started') ? 'waiting' : 'in_progress',
    is_waiting: (batchExamStatus === 'not_started') ? 1 : 0,
    remaining_seconds: durationSeconds,
    auth_token: authToken
  });

  db.addAuditLog(cleanName, 'REGISTRATION', `Started exam in batch ${activeBatch} with ${assignedQuestions.length} randomized questions`);

  const io = req.app.get('io');
  if (io) {
    io.to('teacher').emit('student_registered', {
      id: newSession.id,
      student_name: newSession.student_name,
      batch_code: newSession.batch_code || activeBatch,
      exam_set: newSession.exam_set,
      status: newSession.status,
      is_waiting: !!newSession.is_waiting,
      remaining_seconds: newSession.remaining_seconds,
      total_questions: assignedQuestions.length,
      answered_count: 0
    });
  }

  const sanitizedQuestions = sanitizeQuestionsForClient(assignedQuestions);
  res.json({
    success: true,
    is_reconnect: false,
    is_waiting: !!newSession.is_waiting,
    exam_status: batchExamStatus,
    session_id: newSession.id,
    student_token: authToken,
    auth_token: authToken,
    batch_code: newSession.batch_code || activeBatch,
    student_name: newSession.student_name,
    exam_set: newSession.exam_set,
    exam_title: exam.title,
    duration_minutes: exam.duration_minutes,
    remaining_seconds: newSession.remaining_seconds,
    per_question_time_enabled: !!exam.per_question_time_enabled,
    per_question_time_seconds: exam.per_question_time_seconds || 60,
    competitive_mode_enabled: !!exam.competitive_mode_enabled,
    status: newSession.status,
    answers: {},
    marked_for_review: [],
    questions: sanitizedQuestions,
    assigned_questions: sanitizedQuestions,
    exam: {
      title: exam.title,
      duration_minutes: exam.duration_minutes,
      passing_percentage: exam.passing_percentage,
      per_question_time_enabled: !!exam.per_question_time_enabled,
      per_question_time_seconds: exam.per_question_time_seconds || 60,
      competitive_mode_enabled: !!exam.competitive_mode_enabled
    }
  });
}));

/**
 * POST /api/student/answer
 * Direct HTTP fallback for persisting student answers in real-time.
 * Guarantees persistence even if WebSocket encounters network drops.
 */
router.post('/student/answer', studentBodySizeGuard, asyncHandler(async (req, res) => {
  const session_id = req.body.session_id || req.body.sessionId;
  const question_id = req.body.question_id || req.body.questionId;
  const answers = req.body.answers;

  if (!session_id || question_id === undefined) {
    return res.status(400).json({ success: false, error: 'session_id and question_id are required.' });
  }

  const session = db.getSessionById(session_id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found.' });
  }

  if (!verifyStudentAuth(session, req)) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Invalid student session token.' });
  }

  if (session.status === 'submitted') {
    return res.status(400).json({ success: false, error: 'Examination is already submitted.' });
  }

  const updatedAnswers = db.saveAnswer(session_id, question_id, answers);
  const answeredCount = updatedAnswers ? Object.keys(updatedAnswers).length : 0;

  const io = req.app.get('io');
  if (io) {
    io.to('teacher').emit('student_progress_update', {
      sessionId: session_id,
      answeredCount
    });
  }

  res.json({
    success: true,
    answered_count: answeredCount,
    question_id: question_id
  });
}));

/**
 * GET /api/student/session/:id
 * Fetches current session progress. Requires student session token.
 */
router.get('/student/session/:id', asyncHandler(async (req, res) => {
  const session = db.getSessionById(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found.' });
  }

  if (!verifyStudentAuth(session, req)) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Student Session Token verification required.' });
  }

  const exam = db.getExamById(session.exam_id);
  const sanitizedQuestions = sanitizeQuestionsForClient(session.assigned_questions);
  res.json({
    success: true,
    session: {
      ...session,
      per_question_time_enabled: exam ? !!exam.per_question_time_enabled : false,
      per_question_time_seconds: exam ? (exam.per_question_time_seconds || 60) : 60,
      questions: sanitizedQuestions,
      assigned_questions: sanitizedQuestions
    }
  });
}));

/**
 * GET /api/student/review/:id
 * Returns post-exam scorecard and answers if review is unlocked by teacher.
 */
router.get('/student/review/:id', asyncHandler(async (req, res) => {
  const session = db.getSessionById(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found.' });
  }

  if (!verifyStudentAuth(session, req)) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Student Session Token verification required.' });
  }

  if (session.status !== 'submitted') {
    return res.status(400).json({ success: false, error: 'Exam is not submitted yet.' });
  }

  const isAllowed = db.isReviewAllowed(session.id);
  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      allow_review: false,
      error: 'Review answers have not been published by the instructor yet.'
    });
  }

  const exam = db.getActiveExam();
  const scoreData = gradeSession(
    session.assigned_questions,
    session.answers,
    exam ? exam.passing_percentage : 70,
    exam ? !!exam.competitive_mode_enabled : false
  );

  res.json({
    success: true,
    allow_review: true,
    student_name: session.student_name,
    batch_code: session.batch_code || 'BATCH-01',
    review_questions: scoreData.review_questions,
    score_data: scoreData
  });
}));

/**
 * POST /api/student/submit
 * Submits the paper, evaluates grades, and writes audit archive.
 */
router.post('/student/submit', asyncHandler(async (req, res) => {
  const session_id = req.body.session_id || req.body.sessionId;
  if (!session_id) {
    return res.status(400).json({ success: false, error: 'Session ID is required.' });
  }

  const session = db.getSessionById(session_id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found.' });
  }

  if (!verifyStudentAuth(session, req)) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Student Session Token mismatch or required.' });
  }

  const exam = db.getExamById(session.exam_id) || db.getActiveExam();
  const passingPercent = exam ? exam.passing_percentage : 70;
  const isCompetitive = exam ? !!exam.competitive_mode_enabled : false;

  if (session.status === 'submitted') {
    const isAllowed = db.isReviewAllowed(session.id);
    const scoreData = gradeSession(
      session.assigned_questions,
      session.answers,
      passingPercent,
      isCompetitive
    );

    const resultPayload = {
      total_score: session.total_score,
      max_score: session.max_score,
      percentage: session.percentage,
      passed: session.passed,
      correct_count: session.correct_count ?? scoreData.correct_count,
      wrong_count: session.wrong_count ?? scoreData.wrong_count,
      unattempted_count: session.unattempted_count ?? scoreData.unattempted_count,
      competitive_mode: isCompetitive,
      topic_scores: session.topic_scores,
      allow_review: isAllowed,
      review_questions: isAllowed && scoreData ? scoreData.review_questions : null
    };

    return res.json({
      success: true,
      already_submitted: true,
      result: resultPayload,
      score_data: resultPayload
    });
  }

  // Fail-safe answer sync: Merge and persist all submitted answers before evaluation
  let activeSession = session;
  if (req.body.answers && typeof req.body.answers === 'object') {
    for (const [qId, ansArr] of Object.entries(req.body.answers)) {
      if (Array.isArray(ansArr)) {
        db.saveAnswer(session_id, qId, ansArr);
      }
    }
    activeSession = db.getSessionById(session_id) || session;
  }

  const scoreData = gradeSession(activeSession.assigned_questions, activeSession.answers, passingPercent, isCompetitive);

  db.submitStudentSession(session_id, scoreData);
  db.addAuditLog(session.student_name, 'SUBMISSION', `Completed exam with score ${scoreData.total_score}/${scoreData.max_score} (${scoreData.percentage}%)`);

  const isReviewAllowed = db.isReviewAllowed(session.id);

  const freshSession = db.getSessionById(session_id) || session;
  const accurateViolations = (freshSession.violations_count !== undefined && freshSession.violations_count !== null)
    ? Number(freshSession.violations_count)
    : (session.violations_count || 0);
  const accurateHistory = freshSession.violations_history || session.violations_history || [];

  // Non-blocking permanent history logging
  setImmediate(() => {
    try {
      historyLogger.recordExamAttempt({
        timestamp: new Date().toISOString(),
        student_name: session.student_name,
        exam_title: exam ? exam.title : 'Certification Exam',
        exam_set: session.exam_set,
        total_score: scoreData.total_score,
        max_score: scoreData.max_score,
        percentage: scoreData.percentage,
        passed: scoreData.passed,
        correct_count: scoreData.correct_count,
        wrong_count: scoreData.wrong_count,
        unattempted_count: scoreData.unattempted_count,
        competitive_mode: isCompetitive,
        topic_scores: scoreData.topic_scores,
        violations_count: accurateViolations
      });
    } catch (err) {
      console.error('[HistoryLogger] Async log error:', err);
    }
  });

  const io = req.app.get('io');
  if (io) {
    io.to('teacher').emit('student_submitted', {
      id: session.id,
      sessionId: session.id,
      student_name: session.student_name,
      studentName: session.student_name,
      exam_set: session.exam_set,
      status: 'submitted',
      total_score: scoreData.total_score,
      totalScore: scoreData.total_score,
      max_score: scoreData.max_score,
      maxScore: scoreData.max_score,
      percentage: scoreData.percentage,
      passed: scoreData.passed,
      correct_count: scoreData.correct_count,
      wrong_count: scoreData.wrong_count,
      unattempted_count: scoreData.unattempted_count,
      violations: accurateViolations,
      violations_count: accurateViolations,
      violations_history: accurateHistory,
      competitive_mode: scoreData.competitive_mode,
      topic_scores: scoreData.topic_scores,
      topicScores: scoreData.topic_scores,
      allow_review: isReviewAllowed
    });
  }

  let timeSpentStr = null;
  if (session.start_time) {
    const start = new Date(session.start_time).getTime();
    const end = Date.now();
    const diffSeconds = Math.max(0, Math.floor((end - start) / 1000));
    const m = Math.floor(diffSeconds / 60);
    const s = diffSeconds % 60;
    timeSpentStr = `${m}m ${s < 10 ? '0' : ''}${s}s`;
  }

  const resultObj = {
    total_score: scoreData.total_score,
    max_score: scoreData.max_score,
    percentage: scoreData.percentage,
    passed: scoreData.passed,
    time_spent: timeSpentStr,
    correct_count: scoreData.correct_count,
    wrong_count: scoreData.wrong_count,
    unattempted_count: scoreData.unattempted_count,
    violations: accurateViolations,
    violations_count: accurateViolations,
    violations_history: accurateHistory,
    competitive_mode: scoreData.competitive_mode,
    analytics: computeCandidateAnalytics({
      total_questions: session.assigned_questions.length,
      correct_count: scoreData.correct_count,
      wrong_count: scoreData.wrong_count,
      unattempted_count: scoreData.unattempted_count,
      competitive_mode: scoreData.competitive_mode
    }),
    topic_scores: scoreData.topic_scores,
    allow_review: isReviewAllowed,
    review_questions: isReviewAllowed ? scoreData.review_questions : null
  };

  res.json({
    success: true,
    result: resultObj,
    score_data: resultObj
  });
}));

module.exports = router;
