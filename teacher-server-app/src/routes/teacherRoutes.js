/**
 * ============================================================================
 * EXAMSHIELD LAN - TEACHER ADMINISTRATION & MANAGEMENT API ROUTES
 * ============================================================================
 * Handles teacher control center operations:
 * - /api/admin/login                     : Teacher PIN authentication & session creation
 * - /api/admin/change-pin                : PIN update
 * - /api/exam/config                     : Exam parameters, timing & marking mode
 * - /api/upload/docx                     : DOCX question bank import
 * - /api/teacher/questions/*             : Question CRUD, preview & DOCX export
 * - /api/teacher/batches/*               : Multi-batch creation, activation & deletion
 * - /api/teacher/students                : Live cohort monitoring with real-time ranks
 * - /api/teacher/unfreeze                : 1-click candidate unfreeze after focus violation
 * - /api/teacher/force-submit            : Single-student submission override
 * - /api/teacher/end-exam                : Mass-collection of all active exam papers
 * - /api/teacher/reset-sessions          : Clean exam reset for new session
 * - /api/teacher/review-permission/*     : Answer key publishing controls
 * - /api/export/excel                    : Formatted Master Excel (.xlsx) & CSV (.csv)
 * - /api/history                         : Permanent audit history archive reader
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');

const db = require('../database');
const { gradeSession } = require('../examEngine');
const { generateMasterExcel, computeRanks } = require('../exporter');
const { parseDocxQuestionBank } = require('../parser');
const { exportQuestionsToDocx } = require('../docxExporter');
const historyLogger = require('../historyLogger');
const {
  generateAdminSessionToken,
  requireAdminAuth,
  checkAdminRateLimit,
  recordAdminLoginFailure,
  resetAdminLoginFailures,
  asyncHandler
} = require('../middleware/auth');

// 50MB Memory Storage for authenticated Teacher Question Bank Uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

function logSessionToHistory(session, scoreData, exam) {
  try {
    const auditLogs = db.getRecentAuditLogs ? db.getRecentAuditLogs(200) : [];
    const violations = auditLogs.filter(a =>
      a.student_name === session.student_name && a.event_type === 'FOCUS_LOST'
    ).length;

    historyLogger.recordExamAttempt({
      timestamp: new Date().toISOString(),
      student_name: session.student_name,
      exam_title: exam ? exam.title : 'Examination',
      exam_set: session.exam_set,
      total_score: scoreData.total_score,
      max_score: scoreData.max_score,
      percentage: scoreData.percentage,
      passed: scoreData.passed,
      correct_count: scoreData.correct_count ?? 0,
      wrong_count: scoreData.wrong_count ?? 0,
      unattempted_count: scoreData.unattempted_count ?? 0,
      competitive_mode: !!(exam && exam.competitive_mode_enabled),
      topic_scores: scoreData.topic_scores,
      violations_count: violations
    });
  } catch (err) {
    console.error('[HistoryLogger] Async helper error:', err);
  }
}

// ----------------------------------------------------------------------------
// AUTHENTICATION & PIN MANAGEMENT
// ----------------------------------------------------------------------------
router.post('/admin/login', checkAdminRateLimit, asyncHandler(async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  const { pin } = req.body;
  const exam = db.getActiveExam();

  if (db.verifyAdminPin(exam.id, pin)) {
    resetAdminLoginFailures(ip);
    const token = generateAdminSessionToken();
    return res.json({ success: true, token, expires_in_hours: 4 });
  }

  recordAdminLoginFailure(ip);
  return res.status(401).json({ success: false, error: 'Incorrect Teacher Security PIN.' });
}));

router.post('/admin/change-pin', requireAdminAuth, asyncHandler(async (req, res) => {
  const { current_pin, new_pin } = req.body;
  if (!new_pin || new_pin.trim().length < 4) {
    return res.status(400).json({ success: false, error: 'New PIN must be at least 4 characters.' });
  }

  const exam = db.getActiveExam();
  if (!db.verifyAdminPin(exam.id, current_pin)) {
    return res.status(401).json({ success: false, error: 'Current PIN is incorrect.' });
  }

  db.updateAdminPin(exam.id, new_pin.trim());
  const newToken = generateAdminSessionToken();
  res.json({ success: true, token: newToken, message: 'Teacher PIN updated successfully.' });
}));

// ----------------------------------------------------------------------------
// EXAM CONFIGURATION & SETTINGS
// ----------------------------------------------------------------------------
router.post('/exam/config', requireAdminAuth, asyncHandler(async (req, res) => {
  const {
    title,
    duration_minutes,
    passing_percentage,
    questions_per_topic,
    per_question_time_enabled,
    per_question_time_seconds,
    competitive_mode_enabled
  } = req.body;

  const isCompetitive = competitive_mode_enabled === true ||
                        competitive_mode_enabled === 1 ||
                        competitive_mode_enabled === '1' ||
                        competitive_mode_enabled === 'true';

  let isPerQ = per_question_time_enabled === true ||
               per_question_time_enabled === 1 ||
               per_question_time_enabled === '1' ||
               per_question_time_enabled === 'true';

  // Mutual Exclusivity: Competitive mode disables per-question timer
  if (isCompetitive) {
    isPerQ = false;
  }

  const updated = db.updateActiveExam({
    title,
    duration_minutes: parseInt(duration_minutes, 10),
    passing_percentage: parseFloat(passing_percentage),
    questions_per_topic: parseInt(questions_per_topic, 10),
    per_question_time_enabled: isPerQ,
    per_question_time_seconds: parseInt(per_question_time_seconds, 10) || 60,
    competitive_mode_enabled: isCompetitive
  });

  const io = req.app.get('io');
  if (io) {
    io.to('teacher').emit('exam_config_updated', updated);
  }

  res.json({ success: true, exam: updated });
}));

// ----------------------------------------------------------------------------
// QUESTION BANK MANAGEMENT & DOCX UPLOAD
// ----------------------------------------------------------------------------
router.post('/upload/docx', requireAdminAuth, upload.array('files', 10), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No DOCX file uploaded.' });
  }

  const exam = db.getActiveExam();
  const importedReports = [];
  let totalImported = 0;

  for (const file of req.files) {
    const filenameWithoutExt = path.parse(file.originalname).name;
    const defaultTopic = filenameWithoutExt.replace(/[_\-]+/g, ' ').trim();

    const questions = await parseDocxQuestionBank(file.buffer, defaultTopic);
    if (questions.length > 0) {
      db.insertQuestions(exam.id, questions);
      totalImported += questions.length;
      importedReports.push({
        filename: file.originalname,
        topic: questions[0].topic || defaultTopic,
        imported_count: questions.length
      });
    }
  }

  db.addAuditLog('Teacher', 'UPLOAD_DOCX', `Uploaded ${totalImported} questions across ${req.files.length} file(s)`);

  const io = req.app.get('io');
  if (io) {
    io.to('teacher').emit('questions_updated', { total: totalImported });
  }

  res.json({
    success: true,
    total_imported: totalImported,
    files: importedReports
  });
}));

router.get('/teacher/questions/preview', requireAdminAuth, asyncHandler(async (req, res) => {
  const exam = db.getActiveExam();
  const { topic, search } = req.query;
  const questions = db.getQuestionsPreview(exam.id, topic, search);
  res.json({
    success: true,
    total_count: questions.length,
    questions: questions.map((q, idx) => ({
      id: q.id,
      number: idx + 1,
      topic: q.topic,
      question_text: q.question_text,
      question_html: q.question_html,
      options: q.options,
      correct_answers: q.correct_answers,
      correct_keys: q.correct_keys,
      is_multiple_choice: !!q.is_multiple_choice
    }))
  });
}));

router.delete('/exam/questions', requireAdminAuth, asyncHandler(async (req, res) => {
  const exam = db.getActiveExam();
  const { topic } = req.query;

  if (topic) {
    db.clearQuestionsForTopic(exam.id, topic);
  } else {
    db.clearAllQuestions(exam.id);
  }

  const topicsSummary = db.getTopicsSummary(exam.id);
  const io = req.app.get('io');
  if (io) {
    io.to('teacher').emit('questions_updated', { topics: topicsSummary });
  }

  res.json({ success: true, topics_summary: topicsSummary });
}));

router.post('/teacher/questions/create', requireAdminAuth, asyncHandler(async (req, res) => {
  const exam = db.getActiveExam();
  const { topic, question_text, image_base64, options, correct_keys, is_multiple_choice } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ success: false, error: 'Topic is required.' });
  }
  if (!question_text || !question_text.trim()) {
    return res.status(400).json({ success: false, error: 'Question text is required.' });
  }
  if (!Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ success: false, error: 'At least 2 options are required.' });
  }
  if (!Array.isArray(correct_keys) || correct_keys.length === 0) {
    return res.status(400).json({ success: false, error: 'Please select at least one correct answer.' });
  }

  const cleanTopic = topic.trim();
  const cleanText = question_text.trim();

  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formattedOptions = options.map((opt, idx) => {
    const letter = opt.letter || String.fromCharCode(65 + idx);
    const text = typeof opt === 'string' ? opt.trim() : (opt.text ? opt.text.trim() : '');
    const key = `opt_${idx}`;
    let optHtml = `<p>${escapeHtml(text)}</p>`;
    if (opt && opt.image_base64 && typeof opt.image_base64 === 'string' && opt.image_base64.startsWith('data:image/')) {
      optHtml += `<p><img src="${opt.image_base64}" class="max-h-36 max-w-full rounded-lg border border-slate-200 dark:border-slate-700 my-1.5" alt="Option ${letter} Diagram" /></p>`;
    }
    return {
      key,
      letter,
      text,
      html: optHtml,
      image_base64: (opt && opt.image_base64) ? opt.image_base64 : null
    };
  });

  let questionHtml = `<p>${escapeHtml(cleanText)}</p>`;
  if (image_base64 && typeof image_base64 === 'string' && image_base64.startsWith('data:image/')) {
    questionHtml += `<p><img src="${image_base64}" class="max-w-full h-auto rounded-lg border border-slate-200 dark:border-slate-700 my-2" alt="Question Diagram" /></p>`;
  }

  const mappedCorrectKeys = [];
  const mappedCorrectAnswers = [];

  correct_keys.forEach(k => {
    const target = String(k).toUpperCase();
    const found = formattedOptions.find(o => o.key === k || o.letter.toUpperCase() === target);
    if (found) {
      if (!mappedCorrectKeys.includes(found.key)) mappedCorrectKeys.push(found.key);
      if (!mappedCorrectAnswers.includes(found.letter)) mappedCorrectAnswers.push(found.letter);
    }
  });

  if (mappedCorrectKeys.length === 0) {
    return res.status(400).json({ success: false, error: 'Invalid correct answer selection.' });
  }

  const isMulti = !!is_multiple_choice || mappedCorrectKeys.length > 1;

  db.insertQuestions(exam.id, [{
    topic: cleanTopic,
    question_number: 0,
    question_text: cleanText,
    question_html: questionHtml,
    options: formattedOptions,
    correct_keys: mappedCorrectKeys,
    correct_answers: mappedCorrectAnswers,
    is_multiple_choice: isMulti
  }]);

  const topicsSummary = db.getTopicsSummary(exam.id);
  const io = req.app.get('io');
  if (io) {
    io.to('teacher').emit('questions_updated', { topics: topicsSummary, total_imported: 1 });
  }

  res.json({
    success: true,
    message: 'Question created and added to Question Bank successfully!',
    topics_summary: topicsSummary
  });
}));

router.get('/teacher/questions/export-docx', requireAdminAuth, asyncHandler(async (req, res) => {
  const exam = db.getActiveExam();
  const topic = req.query.topic || 'all';
  const questions = db.getQuestionsPreview(exam.id, topic === 'all' ? null : topic);

  if (!questions || questions.length === 0) {
    return res.status(404).send('No questions found for the requested topic.');
  }

  const cleanTopicName = (topic && topic !== 'all') ? topic : 'All_Topics';
  const buffer = await exportQuestionsToDocx(questions, cleanTopicName);

  const safeFilename = `ExamShield_${cleanTopicName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Questions.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.send(Buffer.from(buffer));
}));

// ----------------------------------------------------------------------------
// BATCH MANAGEMENT
// ----------------------------------------------------------------------------
router.get('/teacher/batches', requireAdminAuth, asyncHandler(async (req, res) => {
  const exam = db.getActiveExam();
  const batches = db.getAllBatches();
  const activeBatchCode = db.getActiveBatchCode(exam ? exam.id : null);
  res.json({ success: true, batches, active_batch: activeBatchCode });
}));

router.post('/teacher/batches/create', requireAdminAuth, asyncHandler(async (req, res) => {
  const { batch_code, batch_name, set_active } = req.body;
  if (!batch_code || !batch_code.trim()) {
    return res.status(400).json({ success: false, error: 'Batch Code is required (e.g. 3287-NET, BATCH-02).' });
  }
  const cleanCode = batch_code.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '_');
  const existing = db.getBatchByCode(cleanCode);
  if (existing) {
    return res.status(400).json({
      success: false,
      error: `Batch code "${cleanCode}" already exists (currently "${existing.batch_name}").`
    });
  }

  const batch = db.createBatch(batch_code, batch_name, !!set_active);
  db.addAuditLog('Teacher', 'BATCH_CREATED', `Created batch ${batch.batch_code} (${batch.batch_name})`);

  const io = req.app.get('io');
  if (io && set_active) {
    io.to('teacher').emit('batch_activated', { batch_code: batch.batch_code });
  }
  res.json({ success: true, batch });
}));

router.post('/teacher/batches/activate', requireAdminAuth, asyncHandler(async (req, res) => {
  const { batch_code } = req.body;
  if (!batch_code) {
    return res.status(400).json({ success: false, error: 'Batch code is required.' });
  }
  const activatedCode = db.setActiveBatch(batch_code);
  db.addAuditLog('Teacher', 'BATCH_ACTIVATED', `Activated batch ${activatedCode}`);

  const io = req.app.get('io');
  if (io) {
    io.to('teacher').emit('batch_activated', { batch_code: activatedCode });
  }
  res.json({ success: true, active_batch: activatedCode });
}));

router.delete('/teacher/batches/:code', requireAdminAuth, asyncHandler(async (req, res) => {
  const batchCode = req.params.code;
  if (!batchCode) {
    return res.status(400).json({ success: false, error: 'Batch code parameter missing.' });
  }
  const result = db.deleteBatch(batchCode);
  db.addAuditLog('Teacher', 'BATCH_DELETED', `Deleted batch ${batchCode} (${result.deletedSessions} sessions removed)`);
  const exam = db.getActiveExam();
  const newActive = db.getActiveBatchCode(exam ? exam.id : null);

  const io = req.app.get('io');
  if (io) {
    io.to('teacher').emit('batch_deleted', {
      batch_code: batchCode,
      active_batch: newActive
    });
  }

  res.json({
    success: true,
    deleted_sessions: result.deletedSessions,
    active_batch: newActive
  });
}));

// ----------------------------------------------------------------------------
// STUDENT MONITORING & PROCTORING CONTROLS
// ----------------------------------------------------------------------------
router.get('/teacher/students', requireAdminAuth, asyncHandler(async (req, res) => {
  const exam = db.getActiveExam();
  const batchFilter = req.query.batch;
  const sessions = db.getAllStudentSessions(exam.id, batchFilter);
  const { rankedMap } = computeRanks(sessions);

  const studentList = sessions.map(s => {
    const answeredCount = Object.keys(s.answers || {}).length;
    const totalQuestions = (s.assigned_questions || []).length;
    return {
      id: s.id,
      student_name: s.student_name,
      batch_code: s.batch_code || 'BATCH-01',
      exam_set: s.exam_set,
      status: s.status,
      freeze_reason: s.freeze_reason,
      freeze_timestamp: s.freeze_timestamp,
      remaining_seconds: s.remaining_seconds,
      answered_count: answeredCount,
      total_questions: totalQuestions,
      total_score: s.total_score,
      max_score: s.max_score,
      percentage: s.percentage,
      passed: s.passed,
      correct_count: s.correct_count ?? 0,
      wrong_count: s.wrong_count ?? 0,
      unattempted_count: s.unattempted_count ?? 0,
      topic_scores: s.topic_scores,
      rank: rankedMap.get(s.id) || '-',
      start_time: s.start_time,
      submitted_at: s.submitted_at,
      allow_review: (!!exam.publish_review_all || !!s.allow_review),
      individual_allow_review: !!s.allow_review
    };
  });

  res.json({
    success: true,
    students: studentList,
    active_batch: db.getActiveBatchCode(exam.id),
    current_filter: batchFilter || 'all'
  });
}));

router.post('/teacher/unfreeze', requireAdminAuth, asyncHandler(async (req, res) => {
  const { session_id } = req.body;
  const session = db.getSessionById(session_id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found.' });
  }

  const unfrozen = db.unfreezeStudentSession(session_id);
  db.addAuditLog(session.student_name, 'UNFROZEN', 'Session restored by Teacher');

  const io = req.app.get('io');
  if (io) {
    io.to(`student_${session_id}`).emit('exam_unfrozen', {
      session_id,
      remaining_seconds: unfrozen.remaining_seconds
    });
    io.to('teacher').emit('student_unfrozen', { session_id });
  }

  res.json({ success: true, session: unfrozen });
}));

router.post('/teacher/force-submit', requireAdminAuth, asyncHandler(async (req, res) => {
  const { session_id } = req.body;
  const session = db.getSessionById(session_id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found.' });
  }

  const exam = db.getExamById(session.exam_id);
  const scoreData = gradeSession(
    session.assigned_questions,
    session.answers,
    exam ? exam.passing_percentage : 70,
    exam ? !!exam.competitive_mode_enabled : false
  );

  const updated = db.submitStudentSession(session_id, scoreData);
  db.addAuditLog(session.student_name, 'FORCE_SUBMIT', 'Exam force-submitted by Teacher');
  logSessionToHistory(session, scoreData, exam);

  const io = req.app.get('io');
  if (io) {
    io.to(`student_${session_id}`).emit('force_submitted', scoreData);
    io.to('teacher').emit('student_submitted', {
      id: session.id,
      student_name: session.student_name,
      exam_set: session.exam_set,
      status: 'submitted',
      total_score: scoreData.total_score,
      max_score: scoreData.max_score,
      percentage: scoreData.percentage,
      passed: scoreData.passed,
      correct_count: scoreData.correct_count,
      wrong_count: scoreData.wrong_count,
      unattempted_count: scoreData.unattempted_count,
      competitive_mode: scoreData.competitive_mode,
      topic_scores: scoreData.topic_scores
    });
  }

  res.json({ success: true, session: updated });
}));

router.post('/teacher/end-exam', requireAdminAuth, asyncHandler(async (req, res) => {
  const exam = db.getActiveExam();
  const sessions = db.getAllStudentSessions(exam.id);
  const io = req.app.get('io');

  let submittedCount = 0;
  for (const s of sessions) {
    if (s.status !== 'submitted') {
      const scoreData = gradeSession(
        s.assigned_questions,
        s.answers,
        exam.passing_percentage,
        !!exam.competitive_mode_enabled
      );
      db.submitStudentSession(s.id, scoreData);
      logSessionToHistory(s, scoreData, exam);
      if (io) {
        io.to(`student_${s.id}`).emit('force_submitted', scoreData);
      }
      submittedCount++;
    }
  }

  if (io) {
    io.to('teacher').emit('exam_ended_all');
  }
  res.json({ success: true, count: submittedCount });
}));

router.delete('/teacher/reset-sessions', requireAdminAuth, asyncHandler(async (req, res) => {
  const exam = db.getActiveExam();
  db.clearExamSessions(exam.id);
  db.addAuditLog('ADMIN', 'RESET_SESSIONS', 'Cleared all student sessions');

  const io = req.app.get('io');
  if (io) {
    io.to('teacher').emit('sessions_cleared');
  }
  res.json({ success: true });
}));

router.post('/teacher/review-permission/all', requireAdminAuth, asyncHandler(async (req, res) => {
  const { publish_all } = req.body;
  const exam = db.getActiveExam();
  const updated = db.setPublishReviewAll(exam.id, !!publish_all);
  db.addAuditLog('Teacher', 'CONFIG_UPDATE', `Review answers published for all students: ${!!publish_all}`);

  const io = req.app.get('io');
  if (io) {
    io.emit('review_permission_updated', {
      publish_all: !!publish_all,
      all_students: true
    });
    io.to('teacher').emit('exam_config_updated', {
      ...exam,
      publish_review_all: updated
    });
  }

  res.json({ success: true, publish_review_all: !!updated });
}));

router.post('/teacher/review-permission/student', requireAdminAuth, asyncHandler(async (req, res) => {
  const { session_id, allow_review } = req.body;
  const session = db.getSessionById(session_id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found.' });
  }

  db.setStudentAllowReview(session_id, !!allow_review);
  db.addAuditLog('Teacher', 'PERM_UPDATE', `Review answer permission set to ${!!allow_review} for ${session.student_name}`);

  const io = req.app.get('io');
  if (io) {
    io.to(`student_${session_id}`).emit('review_permission_updated', {
      session_id,
      allow_review: !!allow_review
    });
    io.to('teacher').emit('student_review_permission_updated', {
      session_id,
      allow_review: !!allow_review
    });
  }

  res.json({ success: true, session_id, allow_review: !!allow_review });
}));

// ----------------------------------------------------------------------------
// EXPORTS & HISTORY ARCHIVE
// ----------------------------------------------------------------------------
router.get('/export/excel', requireAdminAuth, asyncHandler(async (req, res) => {
  const exam = db.getActiveExam();
  const batchFilter = req.query.batch;
  const sessions = db.getAllStudentSessions(exam.id, batchFilter);
  const sortMode = req.query.sort === 'rank' ? 'rank' : 'normal';
  const format = req.query.format === 'csv' ? 'csv' : 'xlsx';

  const buffer = await generateMasterExcel(sessions, sortMode, exam.title, format);

  const ext = format === 'csv' ? 'csv' : 'xlsx';
  const mime = format === 'csv'
    ? 'text/csv; charset=utf-8'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const batchTag = (batchFilter && batchFilter !== 'all') ? `_${batchFilter}` : '';
  const filename = `ExamShield${batchTag}_${sortMode === 'rank' ? 'Rank_Sorted' : 'Normal_Order'}_Results_${new Date().toISOString().slice(0, 10)}.${ext}`;

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}));

router.get('/history', requireAdminAuth, asyncHandler(async (req, res) => {
  const historyText = historyLogger.getHistoryText();
  res.json({ success: true, history: historyText });
}));

// ----------------------------------------------------------------------------
// DATABASE PORTABILITY & BACKUP / RESTORE
// ----------------------------------------------------------------------------
router.get('/teacher/database/backup', requireAdminAuth, asyncHandler(async (req, res) => {
  const tempBackupPath = path.join(os.tmpdir(), `examshield_backup_${Date.now()}.db`);
  await db.backupDatabase(tempBackupPath);

  const activeExam = db.getActiveExam();
  const cleanTitle = (activeExam ? activeExam.title : 'ExamShield')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .substring(0, 30);
  const filename = `${cleanTitle}_Backup_${new Date().toISOString().slice(0, 10)}.db`;

  res.download(tempBackupPath, filename, (err) => {
    try {
      if (fs.existsSync(tempBackupPath)) fs.unlinkSync(tempBackupPath);
    } catch {}
  });
}));

router.post('/teacher/database/restore', requireAdminAuth, upload.single('backup_file'), asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, error: 'No database backup file uploaded.' });
  }

  const tempRestorePath = path.join(os.tmpdir(), `examshield_restore_${Date.now()}.db`);
  fs.writeFileSync(tempRestorePath, req.file.buffer);

  try {
    db.restoreDatabase(tempRestorePath);
  } finally {
    try {
      if (fs.existsSync(tempRestorePath)) fs.unlinkSync(tempRestorePath);
    } catch {}
  }

  db.addAuditLog('Teacher', 'DATABASE_RESTORED', 'Full examination database restored from backup file');

  const io = req.app.get('io');
  if (io) {
    io.emit('exam_data_restored');
  }

  const exam = db.getActiveExam();
  res.json({
    success: true,
    message: 'Database restored successfully! All candidate records and question banks are now active.',
    exam
  });
}));

// ----------------------------------------------------------------------------
// EXAM LIFECYCLE MANAGEMENT (START / STOP / WAITING ROOM)
// ----------------------------------------------------------------------------
router.get('/teacher/exam-status', requireAdminAuth, asyncHandler(async (req, res) => {
  const exam = db.getActiveExam();
  const batchCode = req.query.batch || db.getActiveBatchCode(exam ? exam.id : null);
  const status = db.getBatchExamStatus(batchCode);
  const waitingStudents = db.getWaitingStudents(batchCode);
  const waitingCount = db.getWaitingStudentsCount(batchCode);

  res.json({
    success: true,
    batch_code: batchCode,
    exam_status: status,
    waiting_count: waitingCount,
    waiting_students: waitingStudents
  });
}));

router.post('/teacher/exam/start', requireAdminAuth, asyncHandler(async (req, res) => {
  const { batch_code } = req.body;
  const exam = db.getActiveExam();
  const targetBatch = batch_code || db.getActiveBatchCode(exam ? exam.id : null);

  const result = db.setBatchExamStatus(targetBatch, 'active');
  db.addAuditLog('Teacher', 'EXAM_STARTED', `Live exam launched for batch ${targetBatch}`);

  const io = req.app.get('io');
  if (io) {
    io.emit('exam_status_changed', { batch_code: targetBatch, exam_status: 'active' });
    io.to('batch_' + targetBatch).emit('exam_started', {
      batch_code: targetBatch,
      exam_status: 'active',
      started_at: new Date().toISOString()
    });
    io.emit('exam_started', {
      batch_code: targetBatch,
      exam_status: 'active',
      started_at: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    message: `Exam successfully started for ${targetBatch}! Waiting room candidates launched.`,
    batch_code: targetBatch,
    exam_status: 'active'
  });
}));

router.post('/teacher/exam/stop', requireAdminAuth, asyncHandler(async (req, res) => {
  const { batch_code } = req.body;
  const exam = db.getActiveExam();
  const targetBatch = batch_code || db.getActiveBatchCode(exam ? exam.id : null);

  // Auto-submit all students in progress for this batch
  const activeSessions = db.getAllStudentSessions(exam.id, targetBatch)
    .filter(s => s.status === 'in_progress');

  let autoSubmitted = 0;
  for (const session of activeSessions) {
    try {
      const scoreData = gradeSession(session, session.answers, exam);
      db.submitStudentSession(session.id, scoreData);
      logSessionToHistory(session, scoreData, exam);
      autoSubmitted++;
    } catch (err) {
      console.error('[StopExam] Auto-submit failed for session:', session.id, err);
    }
  }

  db.setBatchExamStatus(targetBatch, 'ended');
  db.addAuditLog('Teacher', 'EXAM_STOPPED', `Exam concluded for batch ${targetBatch}. Auto-submitted ${autoSubmitted} candidate(s).`);

  const io = req.app.get('io');
  if (io) {
    io.emit('exam_status_changed', { batch_code: targetBatch, exam_status: 'ended' });
    io.to('batch_' + targetBatch).emit('exam_ended', {
      batch_code: targetBatch,
      exam_status: 'ended',
      message: 'The examination has been concluded by the instructor.'
    });
    io.emit('exam_ended', {
      batch_code: targetBatch,
      exam_status: 'ended',
      message: 'The examination has been concluded by the instructor.'
    });
  }

  res.json({
    success: true,
    message: `Exam stopped for ${targetBatch}. ${autoSubmitted} papers automatically collected & graded.`,
    batch_code: targetBatch,
    exam_status: 'ended',
    auto_submitted_count: autoSubmitted
  });
}));

router.post('/teacher/exam/set-waiting', requireAdminAuth, asyncHandler(async (req, res) => {
  const { batch_code } = req.body;
  const exam = db.getActiveExam();
  const targetBatch = batch_code || db.getActiveBatchCode(exam ? exam.id : null);

  db.setBatchExamStatus(targetBatch, 'not_started');
  db.addAuditLog('Teacher', 'EXAM_WAITING_SET', `Waiting room mode activated for batch ${targetBatch}`);

  const io = req.app.get('io');
  if (io) {
    io.emit('exam_status_changed', { batch_code: targetBatch, exam_status: 'not_started' });
  }

  res.json({
    success: true,
    message: `Batch ${targetBatch} is now in Waiting Room mode. Candidates can join and wait.`,
    batch_code: targetBatch,
    exam_status: 'not_started'
  });
}));

module.exports = router;
