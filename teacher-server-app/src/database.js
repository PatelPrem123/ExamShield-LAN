const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'examshield.db');
let db = new Database(dbPath);

// Enable WAL mode for high performance concurrent reads and writes
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 60,
      passing_percentage REAL DEFAULT 70,
      questions_per_topic INTEGER DEFAULT 15,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      topic TEXT NOT NULL,
      question_number INTEGER,
      question_text TEXT NOT NULL,
      question_html TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_answers_json TEXT NOT NULL,
      is_multiple_choice INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_id) REFERENCES exams(id)
    );

    CREATE TABLE IF NOT EXISTS student_sessions (
      id TEXT PRIMARY KEY,
      exam_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      exam_set TEXT NOT NULL,
      assigned_questions_json TEXT NOT NULL,
      answers_json TEXT DEFAULT '{}',
      marked_for_review_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'in_progress',
      freeze_reason TEXT,
      freeze_timestamp TEXT,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
      remaining_seconds INTEGER NOT NULL,
      total_score REAL DEFAULT 0,
      max_score REAL DEFAULT 0,
      percentage REAL DEFAULT 0,
      passed INTEGER DEFAULT 0,
      topic_scores_json TEXT DEFAULT '{}',
      submitted_at DATETIME,
      FOREIGN KEY (exam_id) REFERENCES exams(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_name TEXT,
      event_type TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_questions_exam_topic ON questions(exam_id, topic);
    CREATE INDEX IF NOT EXISTS idx_sessions_exam_name ON student_sessions(exam_id, student_name);
  `);

  const safeAddColumn = (table, colDef) => {
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${colDef}`).run();
    } catch {
      // Column already exists
    }
  };

  safeAddColumn('exams', "admin_pin TEXT DEFAULT 'admin123'");
  safeAddColumn('exams', "publish_review_all INTEGER DEFAULT 0");
  safeAddColumn('student_sessions', "allow_review INTEGER DEFAULT 0");
  safeAddColumn('exams', "per_question_time_enabled INTEGER DEFAULT 0");
  safeAddColumn('exams', "per_question_time_seconds INTEGER DEFAULT 60");
  safeAddColumn('exams', "competitive_mode_enabled INTEGER DEFAULT 0");
  safeAddColumn('student_sessions', "correct_count INTEGER DEFAULT 0");
  safeAddColumn('student_sessions', "wrong_count INTEGER DEFAULT 0");
  safeAddColumn('student_sessions', "unattempted_count INTEGER DEFAULT 0");
  safeAddColumn('student_sessions', "auth_token TEXT");
  safeAddColumn('exams', "active_batch_code TEXT DEFAULT 'BATCH-01'");
  safeAddColumn('student_sessions', "batch_code TEXT DEFAULT 'BATCH-01'");

  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_code TEXT NOT NULL UNIQUE,
      batch_name TEXT NOT NULL,
      exam_title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 0
    );
  `);

  try {
    const existingDefault = db.prepare('SELECT id FROM batches LIMIT 1').get();
    if (!existingDefault) {
      db.prepare(`
        INSERT INTO batches (batch_code, batch_name, exam_title, is_active)
        VALUES ('BATCH-01', 'Morning Batch 1', 'Certification Examination', 1)
      `).run();
    }
  } catch (e) { }

  // Migrate any legacy UTC timestamps lacking 'Z' asynchronously so boot is instantaneous
  setImmediate(() => {
    try {
      db.prepare("UPDATE student_sessions SET start_time = replace(start_time, ' ', 'T') || 'Z' WHERE start_time LIKE '____-__-__ __:__:__'").run();
      db.prepare("UPDATE student_sessions SET submitted_at = replace(submitted_at, ' ', 'T') || 'Z' WHERE submitted_at LIKE '____-__-__ __:__:__'").run();
      db.prepare("UPDATE audit_logs SET timestamp = replace(timestamp, ' ', 'T') || 'Z' WHERE timestamp LIKE '____-__-__ __:__:__'").run();
    } catch (e) { }
  });

  // Ensure default active exam exists
  const activeExam = db.prepare('SELECT * FROM exams WHERE is_active = 1 LIMIT 1').get();
  if (!activeExam) {
    db.prepare(`
      INSERT INTO exams (title, duration_minutes, passing_percentage, questions_per_topic, admin_pin, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('CompTIA / VCE Certification Examination', 60, 70, 15, 'admin123', 1);
  }
}

// Exam functions
function getActiveExam() {
  return db.prepare('SELECT * FROM exams WHERE is_active = 1 ORDER BY id DESC LIMIT 1').get();
}

function updateAdminPin(examId, newPin) {
  db.prepare('UPDATE exams SET admin_pin = ? WHERE id = ?').run(newPin, examId);
  return true;
}

function verifyAdminPin(examId, pin) {
  const exam = getExamById(examId);
  if (!exam) return false;
  const currentPin = exam.admin_pin || 'admin123';
  return currentPin === pin;
}

function updateActiveExam(params) {
  const current = getActiveExam();
  if (!current) {
    const res = db.prepare(`
      INSERT INTO exams (title, duration_minutes, passing_percentage, questions_per_topic, per_question_time_enabled, per_question_time_seconds, competitive_mode_enabled, is_active)
      VALUES (@title, @duration_minutes, @passing_percentage, @questions_per_topic, @per_question_time_enabled, @per_question_time_seconds, @competitive_mode_enabled, 1)
    `).run({
      ...params,
      per_question_time_enabled: params.per_question_time_enabled ? 1 : 0,
      per_question_time_seconds: params.per_question_time_seconds || 60,
      competitive_mode_enabled: params.competitive_mode_enabled ? 1 : 0
    });
    return getExamById(res.lastInsertRowid);
  }

  db.prepare(`
    UPDATE exams
    SET title = @title,
        duration_minutes = @duration_minutes,
        passing_percentage = @passing_percentage,
        questions_per_topic = @questions_per_topic,
        per_question_time_enabled = @per_question_time_enabled,
        per_question_time_seconds = @per_question_time_seconds,
        competitive_mode_enabled = @competitive_mode_enabled
    WHERE id = @id
  `).run({
    id: current.id,
    title: params.title ?? current.title,
    duration_minutes: params.duration_minutes ?? current.duration_minutes,
    passing_percentage: params.passing_percentage ?? current.passing_percentage,
    questions_per_topic: params.questions_per_topic ?? current.questions_per_topic,
    per_question_time_enabled: params.per_question_time_enabled !== undefined ? (params.per_question_time_enabled ? 1 : 0) : (current.per_question_time_enabled || 0),
    per_question_time_seconds: params.per_question_time_seconds !== undefined ? Number(params.per_question_time_seconds) : (current.per_question_time_seconds || 60),
    competitive_mode_enabled: params.competitive_mode_enabled !== undefined ? (params.competitive_mode_enabled ? 1 : 0) : (current.competitive_mode_enabled || 0)
  });

  return getActiveExam();
}

function getExamById(id) {
  return db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
}

// Question functions
function clearQuestionsForTopic(examId, topic) {
  return db.prepare('DELETE FROM questions WHERE exam_id = ? AND topic = ?').run(examId, topic);
}

function clearAllQuestions(examId) {
  return db.prepare('DELETE FROM questions WHERE exam_id = ?').run(examId);
}

function insertQuestions(examId, questions) {
  const insertStmt = db.prepare(`
    INSERT INTO questions (
      exam_id, topic, question_number, question_text, question_html,
      options_json, correct_answers_json, is_multiple_choice
    ) VALUES (
      @exam_id, @topic, @question_number, @question_text, @question_html,
      @options_json, @correct_answers_json, @is_multiple_choice
    )
  `);

  const insertMany = db.transaction((rows) => {
    for (const q of rows) {
      insertStmt.run({
        exam_id: examId,
        topic: q.topic,
        question_number: q.question_number || 0,
        question_text: q.question_text,
        question_html: q.question_html,
        options_json: JSON.stringify(q.options),
        correct_answers_json: JSON.stringify(q.correct_keys && q.correct_keys.length > 0 ? q.correct_keys : q.correct_answers),
        is_multiple_choice: q.is_multiple_choice ? 1 : 0
      });
    }
  });

  insertMany(questions);
}

function getQuestionsByExam(examId) {
  const rows = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY id ASC').all(examId);
  return rows.map(r => {
    const options = JSON.parse(r.options_json);
    const rawAnswers = JSON.parse(r.correct_answers_json);
    // Ensure correct_keys contains the actual opt_ keys
    const correctKeys = rawAnswers.map(ans => {
      if (typeof ans === 'string' && ans.startsWith('opt_')) return ans;
      const foundOpt = options.find(o => o.letter && o.letter.toUpperCase() === String(ans).toUpperCase());
      return foundOpt ? foundOpt.key : ans;
    });

    return {
      ...r,
      options,
      correct_answers: rawAnswers,
      correct_keys: correctKeys,
      is_multiple_choice: !!r.is_multiple_choice
    };
  });
}

function getTopicsSummary(examId) {
  return db.prepare(`
    SELECT topic, COUNT(*) as count
    FROM questions
    WHERE exam_id = ?
    GROUP BY topic
    ORDER BY topic ASC
  `).all(examId);
}

function getQuestionsPreview(examId, topic = null, search = null) {
  const allQ = getQuestionsByExam(examId);
  return allQ.filter(q => {
    let matchTopic = true;
    if (topic && topic !== 'all') {
      matchTopic = (q.topic || '').toLowerCase() === topic.toLowerCase();
    }
    let matchSearch = true;
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      const inText = (q.question_text || '').toLowerCase().includes(s);
      const inTopic = (q.topic || '').toLowerCase().includes(s);
      const inOpts = (q.options || []).some(o => (o.text || '').toLowerCase().includes(s));
      matchSearch = inText || inTopic || inOpts;
    }
    return matchTopic && matchSearch;
  });
}

// Batch management functions
function getAllBatches() {
  const batches = db.prepare('SELECT * FROM batches ORDER BY id DESC').all();
  return batches.map(b => {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_students,
        COALESCE(SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END), 0) as submitted_count,
        COALESCE(SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END), 0) as passed_count,
        COALESCE(SUM(CASE WHEN status = 'submitted' AND passed = 0 THEN 1 ELSE 0 END), 0) as failed_count,
        COALESCE(AVG(CASE WHEN status = 'submitted' THEN total_score ELSE NULL END), 0) as avg_score
      FROM student_sessions
      WHERE batch_code = ?
    `).get(b.batch_code);

    const total = (stats && stats.total_students) || 0;
    const passed = (stats && stats.passed_count) || 0;
    const failed = (stats && stats.failed_count) || 0;
    const avg = stats && stats.avg_score ? Number(stats.avg_score.toFixed(1)) : 0;

    return {
      ...b,
      total_students: total,
      total_candidates: total,
      submitted_count: (stats && stats.submitted_count) || 0,
      passed_count: passed,
      passed_candidates: passed,
      failed_count: failed,
      failed_candidates: failed,
      avg_score: avg
    };
  });
}

function createBatch(batchCode, batchName, setActive = false) {
  const cleanCode = batchCode.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '_');
  const cleanName = batchName ? batchName.trim() : `Batch ${cleanCode}`;
  const exam = getActiveExam();

  db.prepare(`
    INSERT INTO batches (batch_code, batch_name, exam_title, is_active)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(batch_code) DO UPDATE SET batch_name = excluded.batch_name
  `).run(cleanCode, cleanName, exam ? exam.title : 'Examination', setActive ? 1 : 0);

  if (setActive) {
    setActiveBatch(cleanCode);
  }

  return db.prepare('SELECT * FROM batches WHERE batch_code = ?').get(cleanCode);
}

function getBatchByCode(batchCode) {
  if (!batchCode) return null;
  const cleanCode = batchCode.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '_');
  return db.prepare('SELECT * FROM batches WHERE batch_code = ?').get(cleanCode);
}

function setActiveBatch(batchCode) {
  const cleanCode = batchCode.trim().toUpperCase();
  const exam = getActiveExam();
  db.prepare('UPDATE batches SET is_active = 0').run();
  db.prepare('UPDATE batches SET is_active = 1 WHERE batch_code = ?').run(cleanCode);
  if (exam) {
    db.prepare('UPDATE exams SET active_batch_code = ? WHERE id = ?').run(cleanCode, exam.id);
  }
  return cleanCode;
}

function getActiveBatchCode(examId) {
  const exam = examId ? getExamById(examId) : getActiveExam();
  if (exam && exam.active_batch_code) return exam.active_batch_code;
  const activeB = db.prepare('SELECT batch_code FROM batches WHERE is_active = 1 LIMIT 1').get();
  return activeB ? activeB.batch_code : 'BATCH-01';
}

function deleteBatch(batchCode) {
  const cleanCode = batchCode.trim().toUpperCase();
  // 1. Delete all student sessions belonging to this batch
  const delSessions = db.prepare('DELETE FROM student_sessions WHERE batch_code = ?').run(cleanCode);
  // 2. Delete the batch record
  const delBatch = db.prepare('DELETE FROM batches WHERE batch_code = ?').run(cleanCode);

  // If the active batch was deleted, activate the latest remaining batch or create BATCH-01
  const exam = getActiveExam();
  if (exam && exam.active_batch_code === cleanCode) {
    const remaining = db.prepare('SELECT batch_code FROM batches ORDER BY id DESC LIMIT 1').get();
    if (remaining) {
      setActiveBatch(remaining.batch_code);
    } else {
      createBatch('BATCH-01', 'Default Batch 1', true);
    }
  }

  return { deletedSessions: delSessions.changes, deletedBatch: delBatch.changes };
}

// Student session functions
function findActiveSessionByName(examId, studentName, batchCode) {
  let session;
  if (batchCode) {
    session = db.prepare(`
      SELECT * FROM student_sessions
      WHERE exam_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?)) AND (batch_code = ? OR batch_code IS NULL)
      ORDER BY start_time DESC LIMIT 1
    `).get(examId, studentName, batchCode);
  } else {
    session = db.prepare(`
      SELECT * FROM student_sessions
      WHERE exam_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))
      ORDER BY start_time DESC LIMIT 1
    `).get(examId, studentName);
  }

  if (!session) return null;
  return parseSessionRecord(session);
}

function getSessionById(sessionId) {
  const session = db.prepare('SELECT * FROM student_sessions WHERE id = ?').get(sessionId);
  if (!session) return null;
  return parseSessionRecord(session);
}

function createStudentSession(sessionData) {
  const nowIso = new Date().toISOString();
  const authToken = sessionData.auth_token || crypto.randomBytes(24).toString('hex');
  const batchCode = sessionData.batch_code || getActiveBatchCode(sessionData.exam_id);

  db.prepare(`
    INSERT INTO student_sessions (
      id, exam_id, student_name, exam_set, assigned_questions_json,
      answers_json, marked_for_review_json, status, remaining_seconds,
      start_time, last_heartbeat, auth_token, batch_code
    ) VALUES (
      @id, @exam_id, @student_name, @exam_set, @assigned_questions_json,
      @answers_json, @marked_for_review_json, @status, @remaining_seconds,
      @start_time, @last_heartbeat, @auth_token, @batch_code
    )
  `).run({
    id: sessionData.id,
    exam_id: sessionData.exam_id,
    student_name: sessionData.student_name,
    exam_set: sessionData.exam_set,
    assigned_questions_json: JSON.stringify(sessionData.assigned_questions),
    answers_json: JSON.stringify(sessionData.answers || {}),
    marked_for_review_json: JSON.stringify(sessionData.marked_for_review || []),
    status: sessionData.status || 'in_progress',
    remaining_seconds: sessionData.remaining_seconds,
    start_time: nowIso,
    last_heartbeat: nowIso,
    auth_token: authToken,
    batch_code: batchCode
  });

  return getSessionById(sessionData.id);
}

function saveAnswer(sessionId, questionId, answersArray) {
  const session = getSessionById(sessionId);
  if (!session) return null;

  const currentAnswers = session.answers || {};
  if (!answersArray || !Array.isArray(answersArray) || answersArray.length === 0) {
    delete currentAnswers[questionId];
  } else {
    currentAnswers[questionId] = answersArray;
  }

  db.prepare(`
    UPDATE student_sessions
    SET answers_json = ?, last_heartbeat = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(currentAnswers), sessionId);

  return currentAnswers;
}

function toggleMarkForReview(sessionId, questionId, isMarked) {
  const session = getSessionById(sessionId);
  if (!session) return null;

  let marks = new Set(session.marked_for_review || []);
  if (isMarked) {
    marks.add(questionId);
  } else {
    marks.delete(questionId);
  }

  const marksArray = Array.from(marks);
  db.prepare(`
    UPDATE student_sessions
    SET marked_for_review_json = ?, last_heartbeat = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(marksArray), sessionId);

  return marksArray;
}

function updateHeartbeat(sessionId, remainingSeconds) {
  db.prepare(`
    UPDATE student_sessions
    SET remaining_seconds = ?, last_heartbeat = CURRENT_TIMESTAMP
    WHERE id = ? AND status != 'submitted'
  `).run(remainingSeconds, sessionId);
}

function freezeStudentSession(sessionId, reason) {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  db.prepare(`
    UPDATE student_sessions
    SET status = 'frozen',
        freeze_reason = ?,
        freeze_timestamp = ?
    WHERE id = ? AND status != 'submitted'
  `).run(reason, timestamp, sessionId);

  return getSessionById(sessionId);
}

function unfreezeStudentSession(sessionId) {
  db.prepare(`
    UPDATE student_sessions
    SET status = 'in_progress',
        freeze_reason = NULL,
        freeze_timestamp = NULL,
        last_heartbeat = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'frozen'
  `).run(sessionId);

  return getSessionById(sessionId);
}

function submitStudentSession(sessionId, scoreData) {
  const submittedAt = new Date().toISOString();
  db.prepare(`
    UPDATE student_sessions
    SET status = 'submitted',
        total_score = @total_score,
        max_score = @max_score,
        percentage = @percentage,
        passed = @passed,
        correct_count = @correct_count,
        wrong_count = @wrong_count,
        unattempted_count = @unattempted_count,
        topic_scores_json = @topic_scores_json,
        submitted_at = @submitted_at
    WHERE id = @id
  `).run({
    id: sessionId,
    total_score: scoreData.total_score,
    max_score: scoreData.max_score,
    percentage: scoreData.percentage,
    passed: scoreData.passed ? 1 : 0,
    correct_count: scoreData.correct_count ?? 0,
    wrong_count: scoreData.wrong_count ?? 0,
    unattempted_count: scoreData.unattempted_count ?? 0,
    topic_scores_json: JSON.stringify(scoreData.topic_scores),
    submitted_at: submittedAt
  });

  return getSessionById(sessionId);
}

function getAllStudentSessions(examId, batchCode) {
  let rows;
  if (batchCode && batchCode !== 'all') {
    rows = db.prepare(`
      SELECT * FROM student_sessions
      WHERE exam_id = ? AND (batch_code = ? OR (batch_code IS NULL AND ? = 'BATCH-01'))
      ORDER BY start_time ASC
    `).all(examId, batchCode, batchCode);
  } else {
    rows = db.prepare(`
      SELECT * FROM student_sessions
      WHERE exam_id = ?
      ORDER BY start_time ASC
    `).all(examId);
  }

  return rows.map(parseSessionRecord);
}

function parseSessionRecord(row) {
  const assigned = JSON.parse(row.assigned_questions_json);
  const answers = JSON.parse(row.answers_json || '{}');

  // Compute fallback counts if legacy record didn't have them
  let correctCount = row.correct_count;
  let wrongCount = row.wrong_count;
  let unattemptedCount = row.unattempted_count;
  if (row.status === 'submitted' && (correctCount === null || correctCount === undefined)) {
    correctCount = 0;
    wrongCount = 0;
    unattemptedCount = 0;
    for (const q of assigned) {
      const sel = answers[q.id];
      if (!sel || sel.length === 0) {
        unattemptedCount++;
      } else {
        const correctKeys = q.correct_keys || [];
        const isCorr = Array.isArray(sel) && Array.isArray(correctKeys) &&
          sel.length === correctKeys.length && sel.every(k => correctKeys.includes(k));
        if (isCorr) correctCount++;
        else wrongCount++;
      }
    }
  }

  return {
    ...row,
    batch_code: row.batch_code || 'BATCH-01',
    assigned_questions: assigned,
    answers: answers,
    marked_for_review: JSON.parse(row.marked_for_review_json || '[]'),
    topic_scores: JSON.parse(row.topic_scores_json || '{}'),
    passed: !!row.passed,
    allow_review: !!row.allow_review,
    auth_token: row.auth_token || '',
    correct_count: correctCount ?? 0,
    wrong_count: wrongCount ?? 0,
    unattempted_count: unattemptedCount ?? 0
  };
}

function setPublishReviewAll(examId, allow) {
  const val = allow ? 1 : 0;
  db.prepare('UPDATE exams SET publish_review_all = ? WHERE id = ?').run(val, examId);
  return val;
}

function setStudentAllowReview(sessionId, allow) {
  const val = allow ? 1 : 0;
  db.prepare('UPDATE student_sessions SET allow_review = ? WHERE id = ?').run(val, sessionId);
  return val;
}

function isReviewAllowed(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) return false;
  const exam = getExamById(session.exam_id);
  if (exam && exam.publish_review_all === 1) return true;
  return !!session.allow_review;
}

function addAuditLog(studentName, eventType, details) {
  db.prepare(`
    INSERT INTO audit_logs (student_name, event_type, details, timestamp)
    VALUES (?, ?, ?, ?)
  `).run(studentName, eventType, details, new Date().toISOString());
}

function getRecentAuditLogs(limit = 50) {
  return db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit);
}

function clearExamSessions(examId) {
  db.prepare('DELETE FROM student_sessions WHERE exam_id = ?').run(examId);
}

/**
 * Creates a clean, consistent snapshot of the SQLite database without locking active transactions.
 * Flushes WAL pages to main DB file before taking the snapshot.
 */
async function backupDatabase(targetPath) {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {
    console.warn('[DB] Checkpoint warning before backup:', e.message);
  }
  return await db.backup(targetPath);
}

/**
 * Validates and restores an ExamShield backup file into the active database.
 * Re-initializes connection and ensures WAL mode pragmas are active.
 */
function restoreDatabase(sourcePath) {
  const tempDb = new Database(sourcePath, { readonly: true });
  try {
    const tables = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    const required = ['exams', 'questions', 'student_sessions'];
    const missing = required.filter(r => !tables.includes(r));
    if (missing.length > 0) {
      throw new Error(`Invalid ExamShield backup: missing required tables (${missing.join(', ')})`);
    }
  } finally {
    tempDb.close();
  }

  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {}
  db.close();

  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';
  if (fs.existsSync(walPath)) try { fs.unlinkSync(walPath); } catch {}
  if (fs.existsSync(shmPath)) try { fs.unlinkSync(shmPath); } catch {}

  fs.copyFileSync(sourcePath, dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  initDb();
  return true;
}

// Ensure database schema and default tables are initialized on module load
initDb();

module.exports = {
  db,
  initDb,
  backupDatabase,
  restoreDatabase,
  getActiveExam,
  updateActiveExam,
  getExamById,
  clearQuestionsForTopic,
  clearAllQuestions,
  insertQuestions,
  getQuestionsByExam,
  getTopicsSummary,
  getQuestionsPreview,
  findActiveSessionByName,
  getSessionById,
  createStudentSession,
  saveAnswer,
  toggleMarkForReview,
  updateHeartbeat,
  freezeStudentSession,
  unfreezeStudentSession,
  submitStudentSession,
  getAllStudentSessions,
  clearExamSessions,
  getAllBatches,
  getBatchByCode,
  createBatch,
  setActiveBatch,
  getActiveBatchCode,
  deleteBatch,
  updateAdminPin,
  verifyAdminPin,
  setPublishReviewAll,
  setStudentAllowReview,
  isReviewAllowed,
  addAuditLog,
  getRecentAuditLogs
};
