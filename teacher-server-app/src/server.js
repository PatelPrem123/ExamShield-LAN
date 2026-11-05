/**
 * ============================================================================
 * EXAMSHIELD LAN - TEACHER CONTROL CENTER & HOST SERVER
 * ============================================================================
 * Architecture: Clean Modular Orchestrator
 * - Routes      : src/routes/studentRoutes.js, src/routes/teacherRoutes.js
 * - Sockets     : src/sockets/proctoringSocket.js
 * - Middleware  : src/middleware/auth.js
 * - Utilities   : src/utils/dateUtils.js
 * - Database    : src/database.js (SQLite WAL Mode)
 * ============================================================================
 */

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const db = require('./database');
db.initDb();
const historyLogger = require('./historyLogger');
const { getLocalIpAddress } = require('./utils/networkUtils');
const { studentBodySizeGuard } = require('./middleware/auth');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const { setupProctoringSocket } = require('./sockets/proctoringSocket');

// Process-level safety guards against crashes
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// App & Server Initialization
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e6
});

// Make io accessible across all route controllers
app.set('io', io);

// ----------------------------------------------------------------------------
// GLOBAL DEFENSIVE MIDDLEWARE
// ----------------------------------------------------------------------------
// 1. Security Headers (Clickjacking, MIME-sniffing, XSS defense)
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// 2. Cross-Origin Resource Sharing
app.use(cors());

// 3. Pre-parsing Body Size Guard for Student Routes (VULN-06 DoS Defense: 200KB limit)
app.use('/api/student', studentBodySizeGuard);

// 4. Request Body Parsers (Tiered: 50MB for teacher uploads, 200KB pre-guarded for students)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ----------------------------------------------------------------------------
// STATIC ASSET SERVING
// ----------------------------------------------------------------------------
app.use('/admin', express.static(path.join(__dirname, 'teacher-ui')));
app.use('/', express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------------------------------
// MODULAR REST API ROUTES
// ----------------------------------------------------------------------------
app.use('/api', studentRoutes);
app.use('/api', teacherRoutes);

// ----------------------------------------------------------------------------
// REALTIME SOCKET.IO ENGINE
// ----------------------------------------------------------------------------
setupProctoringSocket(io);

// ----------------------------------------------------------------------------
// CENTRALIZED ERROR HANDLING MIDDLEWARE
// ----------------------------------------------------------------------------
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      error: 'Payload Too Large: Student requests capped at 200KB'
    });
  }

  console.error('[Server Error]', err.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// ----------------------------------------------------------------------------
// LOCAL NETWORK DISCOVERY & STARTUP
// ----------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();

  setImmediate(() => {
    try {
      historyLogger.syncExistingSessions(db);
    } catch (e) {
      console.error('[Server] History sync error:', e);
    }
  });

  console.log('================================================================');
  console.log('🛡️   ExamShield LAN Host Server Running');
  console.log('================================================================');
  console.log(`👨‍🏫  Teacher Admin Panel : http://${localIp}:${PORT}/admin`);
  console.log(`👨‍🎓  Student Exam URL   : http://${localIp}:${PORT}`);
  console.log(`💻  Localhost URL      : http://localhost:${PORT}`);
  console.log('================================================================');
  console.log('🔒  Operating Mode     : 100% Offline LAN (Zero Internet Required)');
  console.log('================================================================');
});

module.exports = { app, server };
