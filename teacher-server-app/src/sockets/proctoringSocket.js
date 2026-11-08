/**
 * ============================================================================
 * EXAMSHIELD LAN - REALTIME PROCTORING & SOCKET.IO ENGINE
 * ============================================================================
 * Handles live candidate telemetry:
 * - student_join       : Authenticated room subscription
 * - save_answer        : Real-time atomic answer persistence
 * - toggle_review      : Question review bookmarking
 * - heartbeat          : Dynamic timer synchronization
 * - focus_lost         : Anti-cheating tripwire (Alt+Tab, window blur, minimize)
 * - teacher_join       : Authenticated teacher room subscription
 * - disconnect         : Offline candidate status broadcast
 * ============================================================================
 */

const db = require('../database');
const { isValidAdminToken } = require('../middleware/auth');
const { formatLocalTime } = require('../utils/dateUtils');

function setupProctoringSocket(io) {
  io.on('connection', (socket) => {

    // Candidate joins exam room with cryptographic session token validation
    socket.on('student_join', ({ sessionId, studentName, studentToken }) => {
      const session = db.getSessionById(sessionId);
      if (!session) {
        socket.emit('auth_error', { error: 'Session not found' });
        return;
      }

      if (session.auth_token && studentToken && session.auth_token !== studentToken) {
        socket.emit('auth_error', { error: 'Unauthorized: Student Session Token mismatch' });
        return;
      }

      socket.join(`student_${sessionId}`);
      if (session.batch_code) {
        socket.join(`batch_${session.batch_code}`);
      }
      socket.sessionId = sessionId;
      socket.studentName = studentName;
      socket.batchCode = session.batch_code;
      socket.studentToken = studentToken || session.auth_token;

      io.to('teacher').emit('student_online', {
        sessionId,
        studentName,
        batch_code: session.batch_code,
        is_waiting: !!session.is_waiting
      });
    });

    // Real-time answer auto-save with cross-session hijack protection
    socket.on('save_answer', ({ sessionId, questionId, answers, studentToken }) => {
      if (!sessionId || questionId === undefined) return;

      const session = db.getSessionById(sessionId);
      if (!session || session.status === 'submitted') return;

      if (socket.sessionId && socket.sessionId !== sessionId) {
        console.warn(`[Security Alert] Blocked attempt to alter answers: socket ${socket.sessionId} != ${sessionId}`);
        return;
      }

      if (session.auth_token) {
        const token = studentToken || socket.studentToken;
        if (token && token !== session.auth_token) {
          console.warn(`[Security Alert] Blocked save_answer with invalid token for session ${sessionId}`);
          return;
        }
      }

      // Auto-bind session on socket if reconnected
      if (!socket.sessionId) {
        socket.sessionId = sessionId;
        socket.studentName = session.student_name;
        socket.studentToken = session.auth_token;
      }

      const updatedAnswers = db.saveAnswer(sessionId, questionId, answers);
      if (updatedAnswers) {
        const answeredCount = Object.keys(updatedAnswers).length;
        io.to('teacher').emit('student_progress_update', {
          sessionId,
          answeredCount
        });
        socket.emit('answer_saved_ack', { questionId, success: true, answeredCount });
      }
    });

    // Question bookmarking for review
    socket.on('toggle_review', ({ sessionId, questionId, isMarked }) => {
      if (socket.sessionId && socket.sessionId !== sessionId) return;
      const marks = db.toggleMarkForReview(sessionId, questionId, isMarked);
      socket.emit('review_toggled_ack', { questionId, marks });
    });

    // Heartbeat and remaining timer sync
    socket.on('heartbeat', ({ sessionId, remainingSeconds }) => {
      if (socket.sessionId && socket.sessionId !== sessionId) return;
      db.updateHeartbeat(sessionId, remainingSeconds);
      io.to('teacher').emit('student_heartbeat_update', {
        sessionId,
        remainingSeconds
      });
    });

    // Anti-Cheating: Window blur / Alt+Tab focus loss event
    socket.on('focus_lost', ({ sessionId, studentName, reason }) => {
      if (socket.sessionId && socket.sessionId !== sessionId) return;

      const timestamp = formatLocalTime(new Date());
      const violationReason = reason || 'Focus lost (window blur, Alt+Tab, or minimized)';

      const frozen = db.freezeStudentSession(sessionId, violationReason);
      db.addAuditLog(studentName, 'FOCUS_LOST', violationReason);

      // 1. Emit Red Alert to all connected Teacher Dashboards with complete violation telemetry
      io.to('teacher').emit('red_alert', {
        sessionId,
        studentName,
        reason: violationReason,
        timestamp,
        remainingSeconds: frozen ? frozen.remaining_seconds : 0,
        violations_count: frozen ? frozen.violations_count : 1,
        violations_history: frozen ? frozen.violations_history : []
      });

      // 2. Lock candidate screen with violation telemetry
      io.to(`student_${sessionId}`).emit('exam_frozen', {
        reason: violationReason,
        timestamp,
        violations_count: frozen ? frozen.violations_count : 1,
        violations_history: frozen ? frozen.violations_history : []
      });
    });

    // Teacher joins dashboard control room
    socket.on('teacher_join', (data) => {
      const token = data && data.token;
      if (isValidAdminToken(token)) {
        socket.join('teacher');
        socket.emit('teacher_auth_success');
      } else {
        socket.emit('teacher_auth_failed', { error: 'Invalid Security PIN or expired session' });
      }
    });

    // Disconnect telemetry
    socket.on('disconnect', () => {
      if (socket.sessionId) {
        io.to('teacher').emit('student_disconnected', {
          sessionId: socket.sessionId,
          studentName: socket.studentName
        });
      }
    });
  });
}

module.exports = { setupProctoringSocket };
