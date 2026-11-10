# 🛡️ Product Requirements Document (PRD) — ExamShield LAN

**Product Name:** ExamShield LAN  
**Product Version:** v2.5.16  
**Document Status:** Approved & Baseline Production Reference  
**Product Category:** Air-Gapped Computer-Based Testing (CBT) & Real-Time Cyber Proctoring Engine  
**Author:** Antigravity Senior Product Manager & Software Architect  

---

## 1. Executive Summary & Problem Statement

### 1.1 Problem Statement
Educational institutions, university examination boards, training academies, and professional recruitment testing centers frequently conduct high-stakes computer-based examinations. Cloud-based SaaS testing platforms present critical failure points in educational settings:
1. **Unreliable Internet Connectivity:** ISP outages or bandwidth bottlenecks frequently disrupt live examinations, risking candidate exam state loss.
2. **Recurring Per-Student SaaS Licensing:** High recurring per-seat fees strain institutional operating budgets.
3. **Data Sovereignty & Privacy Exposure:** Student personally identifiable information (PII) and institutional question banks are uploaded to third-party cloud servers.
4. **Cheating & Unauthorized Navigation:** Web browsers allow candidates to switch tabs, use search engines, or run unauthorized background utilities unless restricted.

### 1.2 Value Proposition
ExamShield LAN delivers a **100% offline, air-gapped, zero-cloud assessment system**:
- **Zero Internet Dependency:** The server, static assets, database, socket engine, and proctoring run entirely inside an isolated Local Area Network (LAN).
- **Sub-Millisecond Concurrency:** SQLite in Write-Ahead Logging (WAL) mode guarantees concurrent writes for 100–200+ candidates without deadlocks.
- **Real-Time Proctoring & Active Lockdown:** Instant websocket telemetry detects focus loss, tab switching, and window blurring, freezing the exam workstation with proctor-authorized unfreeze.
- **Flexible Examination Models:** Supports both Standard (+1/0) and Competitive Marking (+4/-1 penalty, JEE/NEET/GATE pattern), Per-Question Timers, Multi-Batch Management, and Word (`.docx`) Question Bank ingestion with diagram parsing.

### 1.3 Target Users
1. **Instructors / Proctors / Test Administrators:** Manage question banks, configure exam rules, monitor candidate terminals live, unfreeze workstations, publish review answers, and export grade marksheets.
2. **Student Candidates:** Log in via name/token on any local browser or dedicated kiosk app, take randomized examinations, review question palettes, and receive instant scorecard audits.
3. **Institutional IT Administrators:** Deploy the self-contained single-executable server on Windows without configuring external database engines or cloud infrastructure.

---

## 2. Core User Journeys & User Stories

### 2.1 Journey 1: Administrator / Proctor Workflow
```
[Launch Server] ➔ [Upload Question Bank (.docx/.json)] ➔ [Configure Exam Rules & Batch] ➔ [Start Exam Lifecycle] ➔ [Live Proctoring / Unfreeze] ➔ [End Exam] ➔ [Export Master Excel / CSV]
```
- **Story A1:** *As an administrator*, I want to upload a `.docx` file containing questions, options, and diagram images, so that my existing paper exam formats are ingested without manual retyping.
- **Story A2:** *As a proctor*, I want a live grid view of all connected student terminals showing status, progress, time remaining, and security alerts, so that I can monitor the exam in real-time.
- **Story A3:** *As a proctor*, I want to be alerted immediately when a student switches tabs or minimizes the window, and have their terminal frozen until I authorize an unfreeze.
- **Story A4:** *As an administrator*, I want to export final results to Master Excel (`.xlsx`) and CSV with student scores, percentages, right/wrong/skipped counts, and time taken.

### 2.2 Journey 2: Student Candidate Workflow
```
[Open Browser / Kiosk] ➔ [Enter Candidate Name] ➔ [Waiting Lounge / Direct Start] ➔ [Answer Questions] ➔ [Mark for Review / Navigate] ➔ [Submit Exam] ➔ [View Verified Scorecard & Confetti]
```
- **Story S1:** *As a student*, I want to enter my name on the login screen and join the test without creating cloud accounts or complex passwords.
- **Story S2:** *As a student*, I want a question palette showing answered, unanswered, and marked-for-review questions, so that I can easily navigate my exam paper.
- **Story S3:** *As a student*, I want my answers saved immediately upon selection, so that accidental reloads or hardware resets do not lose my progress.
- **Story S4:** *As a student*, I want to see my audited marksheet immediately after submitting (with animated score reveal, pass/fail status, and breakdown).

---

## 3. Functional Requirements

### 3.1 Examination Lifecycle & Modes
- **FR-01 (Exam Modes):** The system must support two scoring schemes:
  - **Standard Scheme:** Correct = +1 mark, Incorrect = 0, Unattempted = 0.
  - **Competitive Scheme:** Correct = +4 marks, Incorrect = -1 mark penalty, Unattempted = 0. Final percentage is clamped at a minimum of 0%.
- **FR-02 (Timer Models):**
  - **Full Exam Countdown:** Global timer for the entire paper (e.g., 60 minutes).
  - **Per-Question Timer:** Dedicated countdown per question (e.g., 60 seconds). Once expired, automatically advances to the next question and locks previous questions.
  - *Mutual Exclusivity:* Enabling Competitive Mode automatically disables Per-Question Timers to prevent conflicting pacing conditions.
- **FR-03 (Randomization):** Question sequence and multiple-choice options must be randomized per candidate session to eliminate shoulder surfing.
- **FR-04 (Batch Management):** Support multi-batch shifts (e.g., `BATCH-01`, `BATCH-02`). Candidates must be routed to their active batch partition.
- **FR-05 (Waiting Lounge):** When a batch exam is set to "Waiting Room", candidates who join see an interactive waiting lounge with live candidate counts until the instructor clicks "Start Exam".

### 3.2 Question Bank & Ingestion
- **FR-06 (Word .docx Parser):** Ingest questions directly from Microsoft Word documents. Extract and embed high-resolution diagrams as inline Base64 images (`data:image/png;base64,...`).
- **FR-07 (Question Types):** Support Single-Choice (`Answer: B`) and Multi-Select (`Answer: A, C`) question types with automated grading.
- **FR-08 (Key Stripping):** Server must sanitize question payloads sent to candidate clients, stripping `answer`, `explanation`, and internal grading keys to prevent inspect/network payload inspection leaks.

### 3.3 Active Proctoring & Security
- **FR-09 (Focus Loss Detection):** Client monitors `window.blur`, `document.visibilitychange`, and application switches. Any infraction emits a websocket alert and freezes the terminal.
- **FR-10 (Fullscreen Transition Guard):** Pressing `Escape` to toggle fullscreen must not trigger an accidental security freeze. A 1500ms blur suppression window prevents transient focus loss during fullscreen mode switches.
- **FR-11 (Violations Audit Logging):** All infractions are stored in the database (`violations_count` and `violations_json` array with timestamps and infraction descriptions). Infractions are visible on both the Proctor Dashboard and Student Scorecard.
- **FR-12 (One-Click Unfreeze):** Proctors can remotely unfreeze candidate terminals via websocket without restarting the session or losing candidate answers.

### 3.4 Results, Analytics & Reporting
- **FR-13 (Instant Animated Scorecard):** Upon submission, candidates receive an animated radial gauge score reveal with pass/fail evaluation, right/wrong/skipped counts, topic breakdown, and celebratory dual-stage confetti.
- **FR-14 (Answer Key Review Permissions):** Instructor can globally publish or individually unlock question reviews for candidates.
- **FR-15 (Export Engine):** Generates UTF-8 BOM CSV and native styled Excel (`.xlsx`) spreadsheets with candidate ranks, batch codes, marks, right/wrong metrics, and timestamps.

---

## 4. Non-Functional Requirements

### 4.1 Performance & Concurrency
- **NFR-01 (Concurrency SLA):** Host server must support 100–200 concurrent student terminals with average answer save response times `< 25ms`.
- **NFR-02 (Zero Cloud Traffic):** Zero outgoing or incoming internet requests. The platform must operate in a completely air-gapped physical LAN environment.
- **NFR-03 (Database Concurrency):** SQLite must operate in Write-Ahead Logging (`PRAGMA journal_mode = WAL`) and `busy_timeout = 5000` to prevent database lock contention.

### 4.2 Security & Integrity
- **NFR-04 (Token Binding):** Each candidate session is bound to a cryptographically generated session token (`crypto.randomBytes(24)`). Requests lacking a valid token are rejected with `401 Unauthorized`.
- **NFR-05 (DoS & Payload Guard):** Student API endpoints enforce strict payload limits (`200KB` max) to prevent memory exhaustion, while allowing 50MB uploads on admin routes.
- **NFR-06 (XSS & Injection Defense):** Candidate names and question text are sanitized server-side. Output rendered in HTML is sanitized using `escapeHtml()`.

### 4.3 Usability & Reliability
- **NFR-07 (Zero-Install Client):** Candidate terminals require only a modern web browser (Google Chrome, Microsoft Edge, Firefox, or Safari).
- **NFR-08 (Session Resilience):** If a candidate's computer crashes or loses power, rebooting and entering the same name restores the active session, time remaining, and all previously selected answers.

---

## 5. Screen Inventory & States

| Screen | Route / View ID | Target User | Key Components & States |
|---|---|---|---|
| **Student Login** | `GET /` (`#joinScreen`) | Candidate | Name input, "Start Examination" button, server status, responsive theme toggle. |
| **Waiting Lounge** | `#waitingScreen` | Candidate | Batch banner, live candidate counter, animated countdown clock, instruction cards. |
| **Exam Interface** | `#examInterface` | Candidate | Header timer, student identity chip, question palette, question stem, options, "Next", "Previous", "Mark for Review", and "Submit" modal. |
| **Security Freeze Overlay** | `#frozenOverlay` | Candidate | Red alarm screen, infraction count, lock icon, instructions to notify proctor. |
| **Candidate Scorecard** | `#resultScreen` | Candidate | Circular SVG score gauge, distinction shimmer, right/wrong/skipped pills, violations audit card, topic breakdown, answer review. |
| **Teacher Live Monitor** | `GET /admin` (`#tabContent-monitor`) | Proctor | Server IP display, batch stats, exam lifecycle controls (Start, Stop, Waiting), student cards grid with live timers and unfreeze controls. |
| **Question Bank Manager** | `#tabContent-questions` | Proctor | `.docx` dropzone, topic filter, questions preview table, delete/clear actions. |
| **Exam Configuration** | `#tabContent-settings` | Proctor | Passing score %, duration, Competitive Mode toggle, Per-Question Timer toggle. |
| **Batch Manager** | `#tabContent-batches` | Proctor | Batch code selector, create batch, shift status indicators. |
| **Results & Reports** | `#tabContent-results` | Proctor | Leaderboard podium (1st, 2nd, 3rd), responsive 13-column results table, Export to Excel/CSV buttons, Marksheet modal, History log. |

---

## 6. Roles & Permissions Matrix

| Capability / Action | Student | Proctor / Teacher | Host Administrator |
|---|:---:|:---:|:---:|
| Register & Take Exam | ✅ | ❌ | ❌ |
| Submit Exam Paper | ✅ | ✅ (Force Submit) | ✅ (Force Submit) |
| View Personal Scorecard | ✅ | ✅ | ✅ |
| Upload Question Bank | ❌ | ✅ | ✅ |
| Change Exam Duration / Mode | ❌ | ✅ | ✅ |
| View Live Student Terminals | ❌ | ✅ | ✅ |
| Unfreeze Candidate Terminal | ❌ | ✅ | ✅ |
| Publish Answer Key / Solutions | ❌ | ✅ | ✅ |
| Export Excel / CSV Marksheets | ❌ | ✅ | ✅ |
| Access Database Directly | ❌ | ❌ | ✅ |

---

## 7. MVP Scope vs. Out-of-Scope

### 7.1 In-Scope (v2.5.16 Production MVP)
- 100% offline self-hosted Node.js + Express + SQLite WAL server.
- Word `.docx` question paper ingestion with inline diagram extraction.
- Standard & Competitive Marking schemes with Per-Question timers.
- Real-time WebSockets for heartbeat, focus violation, freeze, unfreeze, and timer sync.
- Student responsive web portal & standalone Electron kiosk executable.
- Proctor dashboard with Live Monitor, Question Bank, Settings, Batches, and Results.
- Master Excel (`.xlsx`) and CSV export with full metrics and timestamp formatting.
- Windows Setup Installer (`ExamShield_LAN_v2.5.16_Setup.exe`) with native uninstaller.

### 7.2 Out-of-Scope (Future Releases)
- Cloud SaaS synchronization or multi-campus central database clustering.
- AI webcam video-feed eye-tracking (requires external GPU compute).
- Mobile native apps for iOS / Android (desktop and laptop browser primary focus).
- SSO / SAML integration (offline air-gapped deployment assumes zero internet auth).

---

## 8. Success Criteria & Quality Gates
- **100% Offline Integrity:** Zero external network calls verified via network packet inspection.
- **Automated Test Coverage:** 100% passing across 22 automated unit tests, 10 security tests, and 15 multi-batch tests.
- **Zero Browser Exceptions:** 100% clean Chrome DevTools Protocol (CDP) console logs on both student and teacher portals.
- **Crash Recovery:** 100% answer persistence when terminal browser is forcefully refreshed or killed.
