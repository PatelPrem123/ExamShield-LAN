# PROJECT DISCOVERY & ARCHITECTURE MAP

**Project Name:** ExamShield LAN 🛡️  
**Component:** Teacher Control Center & Student LAN Engine  
**Version:** v2.3.8  
**Audit Date:** 03 November 2026  
**Operating Environment:** Windows 10/11 x64, Node.js v24.19.0, npm 11.8.0  
**Repository Mode:** Local Workspace (Non-Git root deployment)

---

## 1. Executive Summary & Domain Scope

ExamShield LAN is a zero-internet, offline Local Area Network (LAN) Computer-Based Testing (CBT) platform. It allows an institution, school, or testing center to host and administer high-stakes examinations across local Wi-Fi or Ethernet switches without relying on external cloud infrastructure, DNS, or WAN access.

---

## 2. System Architecture & Topology

```
+-------------------------------------------------------------------------+
|                         TEACHER HOST MACHINE                            |
|                                                                         |
|  [ExamShield_Teacher_Server.exe / .bat]                                 |
|         │                                                               |
|         ▼                                                               |
|  [Node.js Runtime v24.19.0]                                             |
|         │                                                               |
|         ├─ Express 5 HTTP REST Engine (Port 3000 / Configurable)       |
|         │    ├── /admin : Teacher Dashboard & Control Panel             |
|         │    ├── /api/teacher/* : Management Endpoints (Protected)      |
|         │    └── /api/student/* : Registration, Autosave, Submit        |
|         │                                                               |
|         ├─ Socket.io Engine : Real-time Proctoring & Live Heartbeats    |
|         │                                                               |
|         ├─ Better-SQLite3 Embedded Engine                               |
|         │    ├── Mode: WAL (Write-Ahead Logging) + synchronous=NORMAL   |
|         │    ├── Storage: examshield.db (Persistent)                    |
|         │    └── Busy Timeout: 5000ms (High Concurrency Protection)     |
|         │                                                               |
|         └─ Exporter & Analytics Engine                                  |
|              ├── ExcelJS (Formatted Master Workbooks with Formulas)     |
|              ├── UTF-8 CSV Streamer                                     |
|              └── Word (.docx) & HTML Certificate Generators             |
+-------------------------------------------------------------------------+
                                    ▲
                                    │ Local Subnet (192.168.x.x / LAN)
                                    ▼
+-------------------------------------------------------------------------+
|                         STUDENT LAN CLIENTS                             |
|                                                                         |
|  [ExamShield_Student.exe / ExamShield_Student_Browser.bat]              |
|         │                                                               |
|         ▼                                                               |
|  [WebView2 / Native Kiosk Client]                                       |
|         ├── Auto-discovers Teacher Host IP via local broadcast / prompt |
|         ├── Enforces Fullscreen / Kiosk Lockdown                        |
|         ├── Traps Alt+Tab, Windows Key, and Context Menu               |
|         ├── Monitors window focus & visibilitychange                    |
|         └── Auto-saves answers every selection directly to Host SQLite  |
+-------------------------------------------------------------------------+
```

---

## 3. Directory Layout & Boundaries

```
E:\vs code\ExamShield LAN\
│
├── ExamShield LAN 🛡️ - Teacher Control Center/   # Production Distribution Mirror
├── ExamShield LAN 🛡️ - Student Portal/          # Student Distribution Mirror
├── teacher-server-app/                          # Primary Server Source & Test Rig
│   ├── src/
│   │   ├── server.js                            # Core HTTP + Socket.io Orchestrator
│   │   ├── database.js                          # SQLite schema, migrations & atomic queries
│   │   ├── examEngine.js                        # Marking schemes (+4/-1, standard), sanitization
│   │   ├── analyticsEngine.js                   # Cohort statistics, median, risk ratings
│   │   ├── exporter.js                          # ExcelJS, CSV, Tie-breaking ranking engine
│   │   ├── historyLogger.js                     # Local-time permanent audit archive (history.bat)
│   │   ├── docxExporter.js                      # Word document marksheet generation
│   │   ├── parser.js                            # Question bank import (JSON, docx, xlsx)
│   │   ├── teacher-ui/                          # Teacher Single-Page Application (HTML/JS/Tailwind)
│   │   └── public/                              # Student Exam Web UI
│   ├── acceptanceTests.js                       # 12 User Acceptance Scenarios
│   ├── batchTests.js                            # 15 Multi-Batch Isolation Scenarios
│   ├── integrationTests.js                      # 13 End-to-End Pipeline Steps
│   ├── securityTests.js                         # 10 Penetration & Vulnerability Tests
│   ├── stressLoadTests.js                       # SQLite WAL Concurrency Stress
│   ├── systemTests.js                           # 8 Full System Performance SLA Checks
│   ├── tddTests.js                              # 10 Test-Driven Analytics Engine Checks
│   └── unitTests.js                             # 18 Core Engine & Exporter Unit Tests
│
├── student-client-app/                          # Lightweight native student launcher
├── runtime/                                     # Portable Node.js runtime for zero-dependency execution
├── ExamShield_Teacher_Server.bat                # 1-Click Teacher Server Launcher
├── ExamShield_Teacher_Server.exe                # Compiled C# Host Wrapper
├── ExamShield_Student_Browser.bat               # 1-Click Student Client Launcher
├── ExamShield_Student.exe                       # Compiled C# Student Kiosk Launcher
├── history.bat / history.csv / history.txt       # Immutable local audit logs
└── quality-audit/                               # Audit reports & verification evidence
```

---

## 4. Trust Boundaries & Security Architecture

1. **Host Server (Teacher Plane):**
   - Protected by Administrator Security PIN (Default `1234` or custom).
   - Rate-limited to prevent brute-force attacks (5 failed attempts trigger HTTP 429 lockout).
   - Issues dynamic cryptographically generated session tokens upon successful authentication.
   - All management endpoints (`/api/teacher/*`) strictly require `Authorization: Bearer <token>`.

2. **Candidate Client (Student Plane):**
   - Frictionless login (Name only, optional batch code).
   - Upon registration, host issues a unique cryptographically signed session token.
   - All subsequent student actions (`/api/student/answer`, `/api/student/submit`, `/api/student/reconnect`) require the session token.
   - Token forgery or attempting to submit for another student is rejected with HTTP 403 Forbidden.
   - Question bank payloads sent to students are strictly **sanitized**: `correct_option`, `solution`, and `explanation` are completely stripped from the client payload.

3. **Denial-of-Service (DoS) Hardening:**
   - Pre-parsing middleware intercepts all `/api/student/*` requests and enforces a strict **200KB payload limit** (returns HTTP 413 Payload Too Large).
   - Teacher question uploads are routed through a separate 50MB endpoint protected by teacher authentication.

4. **HTTP Security Headers:**
   - `X-Frame-Options: DENY` (prevents clickjacking).
   - `X-Content-Type-Options: nosniff` (prevents MIME type confusion).
   - `Referrer-Policy: no-referrer`.

---

## 5. Critical User Journeys

1. **Exam Creation & Topic Seeding:** Teacher imports questions (JSON/Excel/Word), sets duration, passing percentage, and selects marking mode (Standard vs Competitive +4/-1).
2. **Student Registration & Paper Delivery:** Students connect via browser or native kiosk, enter their name, and receive a randomized, sanitized question paper.
3. **Live Auto-Save & State Recovery:** Every radio button selection is asynchronously saved to SQLite in WAL mode; if a student's machine reboots, rejoining restores all answered questions with zero data loss.
4. **Proctoring Violation & Freeze:** If a student switches tabs or minimizes the window, Socket.io notifies the teacher dashboard; the student's paper is automatically locked until the teacher clicks "Unfreeze".
5. **Grading & Tie-Breaking Ranks:** Upon submission, the engine computes Right, Wrong, Skipped, and Score, applying tie-breaking logic (Score -> Percentage -> Submission Timestamp).
6. **Report Generation:** Generates formatted Excel (.xlsx) with colored badges, CSV with UTF-8 BOM, and printable student marksheets.
