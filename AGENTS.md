# 🤖 AI Coding Agent Rules & Guidelines (AGENTS.md) — ExamShield LAN

**System:** ExamShield LAN  
**Version:** v2.5.16  
**Status:** Mandatory Rules for AI Agents (Antigravity, Cursor, Claude Code, Copilot)  
**Rule Precedence:** Highest. All AI modifications must conform strictly to this specification.

---

## 1. Prime Invariants (Never Violate)

1. **100% Offline Air-Gapped Operation:**
   - **NEVER** introduce any dependency, CDN link, web font (`fonts.googleapis.com`), third-party analytics script, or remote API call.
   - All styles (Tailwind), icons (inline SVG), fonts, and JavaScript must be bundled locally.
2. **Preserve Database Backward Compatibility:**
   - **NEVER** run destructive `DROP TABLE` or rename existing columns in production tables (`exams`, `questions`, `student_sessions`, `batches`).
   - Always use the non-destructive defensive migration pattern `safeAddColumn()`.
3. **Never Expose Sensitive Keys to Client:**
   - The question bank contains correct answers (`correct_answers_json`) and teacher explanations. These **MUST NEVER** be sent to student terminals during an active test. Always pass questions through `sanitizeQuestionsForClient()`.
4. **Never Break Concurrency Guarantees:**
   - SQLite **MUST** remain in WAL mode (`PRAGMA journal_mode = WAL`) with `busy_timeout = 5000`. Never remove or weaken these pragmas.

---

## 2. Code Quality, Naming & Style Conventions

1. **Backend (Node.js & Express):**
   - Use standard Node.js ES2022+ features (async/await, destructuring, template literals).
   - Route handlers must always be wrapped with `asyncHandler()` to prevent unhandled promise rejections from crashing the server.
   - Functions and variables: `camelCase` (e.g., `gradeSession`, `studentName`).
   - Database table columns: `snake_case` (e.g., `assigned_questions_json`, `violations_count`).
2. **Frontend (Student & Teacher Portals):**
   - Standard semantic HTML5 + Tailwind CSS utility classes.
   - All dynamic strings rendered in the DOM must pass through `escapeHtml()` to eliminate Cross-Site Scripting (XSS).
   - **NEVER** declare duplicate `const` identifiers within the same function scope (avoiding parse-time `SyntaxError`).
3. **No Unnecessary External Dependencies:**
   - Before adding any npm package, evaluate if native Node.js (`crypto`, `fs`, `path`, `http`) or existing utilities can solve the problem.

---

## 3. Proctoring & Security Rules

1. **Escape Key & Fullscreen Exit:**
   - Pressing `Escape` or toggling fullscreen **MUST NOT** freeze the candidate's terminal.
   - Maintain the 1500ms blur suppression window (`Date.now() - lastFullscreenTransition < 1500`) to ignore transient focus loss during fullscreen mode switches.
2. **Violation Recording:**
   - Violations must be recorded in both `violations_count` (integer) and `violations_json` (timestamped history array).
   - On the student scorecard, always calculate `vCount = Math.max(serverVCount, clientVCount, historyVCount)` to ensure candidates who committed infractions never see a false `0 (Clean)` badge.
3. **One-Click Unfreeze Invariant:**
   - When a proctor unfreezes a student terminal, all existing selected answers and question timer states must be preserved. **NEVER** reset a session on unfreeze.

---

## 4. Marking Schemes & Grading Engine Invariants

1. **Standard Mode:**
   - Correct = +1 mark, Incorrect = 0, Unattempted = 0.
2. **Competitive Mode:**
   - Correct = +4 marks, Incorrect = -1 mark, Unattempted = 0.
   - Total score can be negative (e.g., -2 marks), but percentage **MUST ALWAYS** be clamped at minimum `0.0%`.
3. **Mutual Exclusivity:**
   - Enabling Competitive Mode automatically disables Per-Question Timers, and vice versa.

---

## 5. Testing & Verification Checklist Before Any Commit

Before committing or releasing any code change, the agent **MUST** execute and pass:
1. **Automated Unit Tests:** `node unitTests.js` (Must pass 22/22 tests).
2. **Headless Chrome CDP Audit:** `node scratch/cdp_full_audit.js` (Must show 0 exceptions and 0 console errors across Student Portal and Teacher Console).
3. **Distribution Sync:** Run `scripts/build-distribution.ps1` to mirror changes to `ExamShield LAN 🛡️ - Teacher Control Center` and compile the Windows Setup executable.
4. **Log Documentation:** Append a detailed entry to `quality-audit/IMPLEMENTATION_LOG.md`.
