# 🌐 API Specification (API.md) — ExamShield LAN

**System:** ExamShield LAN  
**Version:** v2.5.16  
**Status:** Approved Production API Contract  
**Author:** Antigravity Senior Backend Architect & API Integration Engineer  

---

## 1. Global API Conventions

### 1.1 Base URL & Content Types
- Base URL: `http://<Host-IP>:3000/api`
- Content Type: `application/json; charset=utf-8` (except file upload endpoints which accept `multipart/form-data` and exports which stream binary octet-streams).
- Standard Response Envelope:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
- Error Response Envelope:
  ```json
  {
    "success": false,
    "error": "Human readable error description",
    "code": "OPTIONAL_ERROR_CODE"
  }
  ```

### 1.2 Authentication Headers
- **Student Routes:** Require bearer session token via header:
  `x-student-token: <48-character-hex-token>`
- **Teacher Admin Routes:** Require admin authorization token or session PIN:
  `x-admin-token: <admin-bearer-token>` or JSON body `{ "pin": "admin123" }`

### 1.3 Payload & Rate Limits
- Student Endpoints: Capped at `200KB` via `studentBodySizeGuard` to prevent memory exhaustion.
- Teacher Question Uploads: Capped at `50MB` for large Word `.docx` question banks with embedded diagrams.
- Admin Login Route: Rate-limited with IP lockout after 5 consecutive failed attempts.

---

## 2. Student Examination API Endpoints

### 2.1 `GET /api/system/info`
Returns public, sanitized exam configuration, pacing rules, and host connection metadata.
- **Auth:** None (Public)
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "host_ip": "192.168.29.139",
    "port": 3000,
    "admin_url": "http://192.168.29.139:3000/admin",
    "student_url": "http://192.168.29.139:3000",
    "active_batch": "BATCH-01",
    "exam_status": "active",
    "waiting_count": 0,
    "exam": {
      "id": 1,
      "title": "CompTIA / VCE Certification Examination",
      "duration_minutes": 60,
      "passing_percentage": 70,
      "per_question_time_enabled": 0,
      "per_question_time_seconds": 60,
      "competitive_mode_enabled": 0,
      "total_questions_in_pool": 32,
      "topics": [{ "topic": "Networking", "count": 8 }]
    }
  }
  ```

---

### 2.2 `POST /api/student/register`
Registers a new candidate session, assigns a randomized question pool, or re-attaches an existing session.
- **Auth:** None (Registration)
- **Request Body:**
  ```json
  {
    "student_name": "Rahul Sharma",
    "batch_code": "BATCH-01"
  }
  ```
- **Response (`200 OK` - Direct Start):**
  ```json
  {
    "success": true,
    "session_id": "s_1794137827525_xb71h8",
    "student_token": "cb531c748052d0d1f0b85e9bfdf8c78200f877edbf199eea",
    "student_name": "Rahul Sharma",
    "batch_code": "BATCH-01",
    "exam_title": "Certification Examination",
    "duration_minutes": 60,
    "remaining_seconds": 3600,
    "status": "in_progress",
    "per_question_time_enabled": 0,
    "competitive_mode_enabled": 0,
    "questions": [
      {
        "id": 101,
        "topic": "Networking",
        "question_text": "What port does DNS use by default?",
        "question_html": "<p>What port does DNS use by default?</p>",
        "options": [
          { "label": "A", "text": "53" },
          { "label": "B", "text": "80" },
          { "label": "C", "text": "443" },
          { "label": "D", "text": "22" }
        ],
        "is_multiple_choice": 0
      }
    ]
  }
  ```
- **Response (`200 OK` - Waiting Room Mode):**
  ```json
  {
    "success": true,
    "status": "waiting",
    "is_waiting": true,
    "batch_code": "BATCH-01",
    "message": "Examination has not started yet. Please wait in the waiting lounge."
  }
  ```

---

### 2.3 `POST /api/student/answer`
Persists candidate's answer to a specific question in real-time.
- **Headers:** `x-student-token: <token>`
- **Request Body:**
  ```json
  {
    "session_id": "s_1794137827525_xb71h8",
    "question_id": 101,
    "selected_options": ["A"],
    "marked_for_review": false,
    "remaining_seconds": 3540
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Answer recorded successfully."
  }
  ```

---

### 2.4 `POST /api/student/submit`
Concludes candidate's examination, runs auto-grading, calculates right/wrong counts, and generates the final scorecard.
- **Headers:** `x-student-token: <token>`
- **Request Body:**
  ```json
  {
    "session_id": "s_1794137827525_xb71h8",
    "answers": { "101": ["A"], "102": ["B", "C"] },
    "remaining_seconds": 1820
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "status": "submitted",
    "result": {
      "total_score": 28,
      "max_score": 32,
      "percentage": 87.5,
      "passed": true,
      "time_spent": "29m 40s",
      "correct_count": 7,
      "wrong_count": 1,
      "unattempted_count": 0,
      "violations": 0,
      "violations_count": 0,
      "violations_history": [],
      "competitive_mode": false,
      "topic_scores": {
        "Networking": { "score": 7, "total": 8, "percentage": 87.5 }
      }
    }
  }
  ```

---

### 2.5 `GET /api/student/review/:id`
Retrieves answer key, solutions, and explanations if unlocked by the instructor.
- **Headers:** `x-student-token: <token>`
- **Response (`200 OK`):** Returns assigned questions with correct answer keys and candidate's selections.
- **Response (`403 Forbidden`):** `{ "success": false, "error": "Instructor has not published answer review yet." }`

---

## 3. Teacher Administration API Endpoints

### 3.1 Authentication & Exam Lifecycle

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/login` | Authenticate with admin PIN; returns admin session bearer token. |
| `POST` | `/api/admin/change-pin` | Update administrative login PIN. |
| `GET` | `/api/teacher/exam-status` | Get current batch and exam state (`not_started`, `active`, `ended`). |
| `POST` | `/api/teacher/exam/start` | Launch live exam for active batch; releases all waiting students. |
| `POST` | `/api/teacher/exam/set-waiting`| Set active batch into waiting lounge mode. |
| `POST` | `/api/teacher/exam/stop` | End live exam; auto-submits all active and frozen terminals. |

---

### 3.2 Live Proctoring & Control

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/teacher/students` | Get all connected students with live status, timers, and violations. |
| `POST` | `/api/teacher/freeze` | Manually freeze a candidate's workstation with a custom reason. |
| `POST` | `/api/teacher/unfreeze` | Remotely unfreeze a candidate workstation; resumes exam instantly. |
| `POST` | `/api/teacher/force-submit` | Force-submit a specific candidate's exam from proctor console. |
| `POST` | `/api/teacher/end-exam` | Bulk submit and conclude all student papers. |
| `DELETE`| `/api/teacher/reset-sessions` | Clear student session data for a fresh test run. |

---

### 3.3 Question Bank & Ingestion

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload/docx` | Upload and parse Microsoft Word (`.docx`) file; extracts diagrams. |
| `GET` | `/api/teacher/questions/preview`| Paginated list of ingested questions with topic breakdown. |
| `DELETE`| `/api/exam/questions` | Clear all questions from active question bank. |
| `POST` | `/api/teacher/questions/create` | Manually insert a single custom question. |
| `GET` | `/api/teacher/questions/export-docx` | Download current question bank as a Word `.docx` file. |

---

### 3.4 Results, Analytics & Reports

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/export/excel` | Stream Master Excel spreadsheet (`.xlsx`) with formulas and styling. |
| `GET` | `/api/history` | Read plain-text and CSV audit history of all past examinations. |
| `POST` | `/api/teacher/review-permission/all` | Toggle global answer review permissions for all candidates. |
| `POST` | `/api/teacher/review-permission/student` | Toggle solution review access for an individual student. |
| `GET` | `/api/teacher/database/backup` | Download live SQLite database snapshot (`examshield.db`). |
| `POST` | `/api/teacher/database/restore`| Restore database snapshot from an uploaded file. |

---

## 4. WebSocket (Socket.IO) Event Contracts

### 4.1 Client to Server (`Client ➔ Server`)
- `student_join`: `{ sessionId, studentName, studentToken }`
- `teacher_join`: `{ adminToken }`
- `heartbeat`: `{ sessionId, remainingSeconds }`
- `focus_lost`: `{ sessionId, reason }`
- `force_submit_request`: `{ sessionId }`

### 4.2 Server to Client (`Server ➔ Client`)
- `exam_started`: Broadcast to waiting students when exam begins.
- `exam_frozen`: `{ reason, violations_count }` locked on candidate terminal.
- `exam_unfrozen`: `{ token }` sent to student when proctor unfreezes.
- `force_submitted`: `{ ...scoreData, violations, violations_count }` ends student session.
- `red_alert`: `{ student_name, reason, count }` broadcast to proctors on infraction.
- `student_connected` / `student_disconnected`: Real-time presence indicators.
