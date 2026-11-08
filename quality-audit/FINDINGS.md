# CODE AUDIT & DEFECT FINDINGS REGISTER

**Project:** ExamShield LAN 🛡️  
**Audit Specification:** Antigravity Direct Software Audit & Testing Work Order V3  
**Date:** 03 November 2026 (Post-Remediation Verification)  

---

## 1. Defect Findings & Resolution Register

| Finding ID | Severity | Category | File & Location | Evidence | Root Cause | Remediation & Status |
|---|---|---|---|---|---|---|
| **BUG-C01** | **CRITICAL** | Reliability / Runtime | `src/database.js:494` | `saveAnswer` threw uncaught `TypeError: Cannot read properties of undefined (reading 'length')` when payload was undefined. | Incomplete null-check (`answersArray === null || answersArray.length === 0`). | **RESOLVED & VERIFIED:** Replaced with safe defensive check: `!answersArray \|\| !Array.isArray(answersArray) \|\| answersArray.length === 0`. Verified via regression unit test. |
| **BUG-M01** | **HIGH** | Security / Stored XSS | `src/server.js:569`, `teacher-ui/index.html:1665` | Candidate name containing `<script>` or HTML was injected into Teacher Dashboard DOM via `innerHTML`. | Missing server-side HTML stripping and missing client-side escaping. | **RESOLVED & VERIFIED:** Implemented two-layer defense-in-depth: Server strips all HTML tags (`replace(/<[^>]*>/g, '')`) and rejects tag-only names; Teacher UI wraps all student names with `escapeHtml()`. |
| **BUG-M02** | **HIGH** | Grading / Logic | `src/examEngine.js:224` | `arraysEqualAsSets(['A', 'B'], ['A', 'A'])` returned `true` due to asymmetric set check. | Checked lengths but looped only over one set without verifying symmetric set sizes. | **RESOLVED & VERIFIED:** Updated to verify `setA.size === setB.size` and symmetric inclusion. Verified with unit test. |
| **BUG-L01** | **LOW** | Audit / Logging | `src/historyLogger.js:167` | Substring match on candidate name could skip recording new candidates whose names are substrings of previous ones. | Used `existingBatContent.includes('Candidate: ' + s.student_name)` without delimiter boundaries. | **RESOLVED & VERIFIED:** Delimited with exact pipe boundaries: `\| Candidate: ${s.student_name} \|`. |
| **BUG-L02** | **LOW** | Exporter / Sort | `src/exporter.js:64` | `computeRanks` yielded `NaN` comparison when dates were undefined, causing non-deterministic rank ordering. | Directly subtracted `new Date(undefined).getTime()`. | **RESOLVED & VERIFIED:** Added fallback to `0` and `isNaN` guards for all timestamp calculations. |
| **VULN-01** | **HIGH** | Security / Auth | `src/server.js:145` | Repeated failed PIN requests were previously unlimited, allowing brute-force attempts. | Absence of request throttling / rate limiter on `/api/teacher/auth`. | **RESOLVED & VERIFIED:** Sliding-window rate limiter locks out attacker after 5 failed PIN attempts (`HTTP 429`). |
| **VULN-02** | **HIGH** | Security / Auth | `src/server.js:192` | Teacher endpoints previously accepted a static PIN header or unverified cookie. | Lack of dynamic cryptographic session token management. | **RESOLVED & VERIFIED:** Implemented dynamic 256-bit cryptographically random tokens (`crypto.randomBytes(32)`). |
| **VULN-03** | **HIGH** | Security / Session | `src/server.js:342` | Any student could submit or overwrite another student's exam by modifying the candidate session ID. | Student endpoints lacked per-session cryptographic authentication tokens. | **RESOLVED & VERIFIED:** Unique cryptographic `student_token` required on all student requests (`HTTP 403` on mismatch). |
| **VULN-06** | **MEDIUM** | Security / DoS | `src/server.js:42` | Global 50MB body limit allowed students to flood server memory. | Sized for teacher file uploads rather than route-tiered. | **RESOLVED & VERIFIED:** Pre-parsing middleware rejects student payloads >200KB with `HTTP 413`. |
| **VULN-07** | **LOW** | Security / Headers | `src/server.js:55` | Responses lacked defensive HTTP security headers. | Default Express headers used. | **RESOLVED & VERIFIED:** Added `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`. |

---

## 2. Post-Remediation Verification Status

All 10 identified issues have been **100% remediated, unit-tested, and verified** across live test suites. Zero open vulnerabilities or regressions remain.
