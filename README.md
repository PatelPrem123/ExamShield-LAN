# 🛡️ ExamShield LAN — Enterprise Hardened Edition (v2.5.0)

> **High-Performance 100% Offline Campus Examination Platform & Anti-Cheat Proctoring Engine**  
> *Engineered for Schools, Colleges, Universities, and Professional Certification Labs.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6.svg?logo=windows)](https://microsoft.com)
[![Version: 2.5.0](https://img.shields.io/badge/Version-2.5.0-success.svg)](https://github.com/PatelPrem123/ExamShield-LAN)
[![Offline: Air-Gapped](https://img.shields.io/badge/Operation-100%25%20Offline%20Air--Gapped-darkgreen.svg)](#)
[![Database: SQLite WAL](https://img.shields.io/badge/Database-SQLite%20WAL%20(Zero--Deadlock)-blueviolet.svg)](#)

---

## 📖 Overview

**ExamShield LAN** is an enterprise-grade Computer-Based Testing (CBT) and proctoring engine designed to run completely inside an isolated Local Area Network (LAN). 

Unlike cloud-based assessment software that demands continuous high-speed internet, recurring per-student subscription fees, and third-party data uploads, ExamShield LAN runs **100% offline**:
- **Zero Internet Requirement:** All static assets, fonts, icons, JavaScript, and styles are bundled locally.
- **Ultra-Low Latency:** High-speed real-time Socket.IO bidirectional events for live student status and timer synchronization.
- **Zero Deadlocks:** SQLite Write-Ahead Logging (WAL) concurrency handles 100–200+ concurrent students with sub-millisecond answer saves.

---

## 🌟 Key Architecture & Features

### 1. Dual Access Modes (Simultaneous)
* **Zero-Install Web Access:** Students simply open Chrome or Edge on any connected device and navigate to `http://<Teacher-IP>:3000`.
* **Kiosk Desktop App (.exe):** Standalone fullscreen Electron kiosk lock with taskbar suppression.
* Both web and desktop clients participate in the exact same live examination batch simultaneously.

### 2. Microsoft Word (.docx) Importer with Embedded Diagrams
* Auto-parses standard `.docx` question banks with topic headers.
* Extracts embedded diagram images and compresses them into high-resolution Base64 (`data:image/png;base64,...`).
* Supports single-choice `Answer: C (single)` and multi-select `Answer: B, C (multiple)` questions.
* Teacher explanation sections are automatically stripped to guarantee answer key confidentiality.

### 3. Real-Time Anti-Cheat & Active Proctoring
* **Window Focus & Tab Detection:** Tracks `window.blur`, `document.visibilitychange`, and `Alt+Tab`.
* **Instant Lockout:** Switching tabs or minimizing immediately freezes the student's screen with an alarm modal.
* **Teacher Invigilation Dashboard:** Real-time red violation alert with student name, violation reason, and counter.
* **1-Click Live Unfreeze:** Teachers can inspect the student's workstation and click *Unfreeze* to restore their session with all previously saved answers intact.

### 4. Flexible Marking Schemes
* **Standard Marking Scheme:** +1 mark for correct answers, 0 for wrong, 0 for unattempted.
* **Competitive Negative Marking (JEE / NEET / GATE Pattern):** +4 marks for correct answers, -1 mark penalty for wrong answers, and 0 for skipped questions (total percentage clamped at minimum 0%).
* **Mutual Exclusivity:** Competitive Mode automatically adjusts timer rules to avoid conflicting timer conditions.

### 5. Multi-Batch Examination Management
* Organize exams by shifts or dates (e.g. `BATCH-01`, `BATCH-02`, Morning Shift, Afternoon Shift).
* Isolated student sessions — students with identical names across different batches will never collide.
* Unified batch filter across Live Monitor and Results scorecards.

### 6. Results, Leaderboard & Reports
* **Instant Sub-4ms Server Grading:** Submissions graded immediately against server-side keys.
* **Tie-Breaking Leaderboard Ranking:** Sorts by `Score -> Percentage -> Earlier Submission Timestamp`.
* **Master Excel (.xlsx) Export:** Full multi-column workbooks with colored headers, individual topic scores, and rank order.
* **Universal CSV Export:** UTF-8 BOM CSV files compatible with Excel, LibreOffice, and Google Sheets.
* **Certificate Marksheet:** Institutional marksheet with header logo, topic scores breakdown, pass/fail status, and 1-click Print/PDF.

### 7. 💾 1-Click Data Portability (School PC ➔ Home Laptop)
* **1-Click Snapshot Backup (.db):** Checkpoints SQLite WAL and downloads a timestamped backup snapshot (`ExamShield_Backup_YYYY-MM-DD.db`).
* **1-Click Hot-Swap Restore:** Upload any snapshot `.db` file onto any computer running ExamShield. The engine validates table schemas and hot-swaps active database connections in under 50ms!
* **Home Grading Workflow:** Teachers take the backup on a USB pen drive to grade papers, review solutions, or export reports from home without staying late in the school lab.

---

## 🛠️ Technology Stack

| Layer | Technology | Role |
|---|---|---|
| **Runtime** | Node.js (v20+ / Portable Embedded) | Host server execution engine |
| **Backend** | Express 5.x, CORS | REST API & static file delivery |
| **Database** | Better-SQLite3 (WAL Mode) | High-throughput ACID storage & concurrency |
| **Transport** | Socket.IO (v4.x) | Real-time bi-directional WebSocket events |
| **Packaging** | Windows Forms (.NET 4.8 / C#) | Native Setup Installer with Desktop Shortcut & Start Menu |
| **Documents** | Mammoth, Docx (v9.x) | Word `.docx` parsing & Base64 diagram extraction |
| **Spreadsheets**| ExcelJS | Multi-column styled Excel workbook generation |
| **Frontend** | HTML5, Tailwind CSS, Vanilla JS | Zero-dependency dark/light responsive UI |

---

## 🚀 Getting Started

### Option 1: Windows Setup Installer (Recommended)
1. Run **`ExamShield_LAN_v2.5.0_Setup.exe`**.
2. Select destination directory (Default: `C:\ExamShield LAN`).
3. The installer creates a Desktop shortcut (`ExamShield LAN - Teacher Control Center`) with custom shield icon and Start Menu program entries.
4. Launch and start testing!

### Option 2: Portable Zero-Install (USB Plug-and-Play)
1. Extract **`ExamShield LAN 🛡️ - Teacher Control Center.zip`** to any folder or USB drive.
2. Double-click **`ExamShield_Teacher_Server.exe`** (or `ExamShield_Teacher_Server.bat`).
3. The server starts in under 2 seconds. The URL (e.g. `http://192.168.1.15:3000`) is displayed on screen for students.

---

## 📁 Repository Structure

```
ExamShield-LAN/
├── scripts/
│   └── build-distribution.ps1        # Automated build & packaging pipeline
├── sample-papers/                    # Ready-to-import sample DOCX exams
│   ├── Hardware.docx
│   ├── Networking.docx
│   ├── Operating_Systems.docx
│   └── Service_Desk.docx
├── student-client-app/               # Standalone Electron student kiosk app
│   ├── main.js
│   └── package.json
├── teacher-server-app/               # Main Backend & Teacher Control Center
│   ├── package.json
│   ├── unitTests.js                  # 22 automated unit test suites
│   └── src/
│       ├── server.js                 # Express server & security headers
│       ├── database.js               # SQLite WAL schema & snapshot backup/restore
│       ├── examEngine.js             # Randomization, grading & competitive marking
│       ├── parser.js                 # Word DOCX & Base64 image extractor
│       ├── exporter.js               # Excel (.xlsx) & CSV generation
│       ├── routes/
│       │   ├── studentRoutes.js      # Student login, auto-save & submission APIs
│       │   └── teacherRoutes.js      # Admin control, batch manager & backup APIs
│       ├── teacher-ui/index.html     # Teacher dashboard (light/dark mode)
│       └── public/index.html         # Candidate exam portal (VCE style)
├── app.ico                           # Application shield icon
├── build.ps1                         # Root build helper
├── ExamShield_LAN_Documentation.docx # Technical Architecture specifications
├── Teacher_Instructions.txt          # Teacher & Invigilator Operations Guide
└── README.md                         # Product Documentation
```

---

## 🧪 Testing & Verification

ExamShield LAN includes an extensive test suite verifying mathematical grading accuracy, SQLite WAL transactions, session security, and regression defenses:

```bash
cd teacher-server-app
npm test
```

All 22 test suites pass with 100% success rate:
- Standard & Competitive (+4 / -1) Negative Marking
- SQLite WAL Concurrency & Safe Migrations
- Leaderboard Ranking & UTF-8 BOM CSV / Styled Excel Export
- Anti-Cheat & Student State Restoration
- Defensive Input Validation & DoS Protection

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
