# AUTOMATED TEST EXECUTION & EVIDENCE REPORT

**Project:** ExamShield LAN 🛡️  
**Audit Specification:** Antigravity Direct Software Audit & Testing Work Order V3  
**Date of Execution:** 03 November 2026, 22:27 – 22:30 IST (Post-Remediation Benchmark)  
**Environment:** Windows 11 Pro 64-bit | Node.js v24.19.0 | npm 11.8.0 | SQLite 3 (WAL mode)  
**Host Subnet Target:** `127.0.0.1` / Local LAN loopback  

---

## 1. Test Suite Execution Summary

| Test Suite | Command Executed | Total Tests | Passed | Failed | Skipped | Duration | Status |
|---|---|---|---|---|---|---|---|
| **1. Unit Tests (Engine & Edge Cases)** | `npm test` (`node unitTests.js`) | 22 | 22 | 0 | 0 | 1.45s | **PASS** |
| **2. Security & Penetration Hardening** | `node securityTests.js` | 12 | 12 | 0 | 0 | 2.15s | **PASS** |
| **3. End-to-End Integration** | `node integrationTests.js` | 13 | 13 | 0 | 0 | 3.31s | **PASS** |
| **4. Multi-Batch Isolation** | `node batchTests.js` | 15 | 15 | 0 | 0 | 1.25s | **PASS** |
| **5. Full System & Performance** | `node systemTests.js` | 8 | 8 | 0 | 0 | 1.23s | **PASS** |
| **6. User Acceptance (UAT)** | `node acceptanceTests.js` | 12 | 12 | 0 | 0 | 2.60s | **PASS** |
| **7. Analytics & Proctoring TDD** | `node tddTests.js` | 10 | 10 | 0 | 0 | 0.01s | **PASS** |
| **8. 100-Candidate Concurrency** | `node test_100_students.js` | 100 | 100 | 0 | 0 | 4.88s | **PASS** |
| **TOTALS** | — | **192** | **192** | **0** | **0** | **16.88s** | **100% PASS** |

---

## 2. Regression & Boundary Verification

- **BUG-C01 (saveAnswer undefined payload):** Verified safe execution with `undefined`, `null`, and string inputs. Zero TypeErrors.
- **BUG-M01 (Stored XSS):** Verified `<script>` and `<b>` tags stripped during registration. Verified name-only HTML tags rejected with 400.
- **BUG-M02 (arraysEqualAsSets):** Verified asymmetric set rejection (`['opt_1', 'opt_2']` vs `['opt_1', 'opt_1']` correctly returns `false`).
- **BUG-L01 (History Logger):** Verified exact delimiter matching prevents substring false-positive skips.
- **BUG-L02 (computeRanks sort):** Verified `computeRanks` handles candidates with missing `submitted_at` or `start_time` without NaN sort corruption.

---

## 3. Real Performance Benchmarks

- **Workload:** 100 concurrent students, 800 SQLite database writes, 100 submissions, 1 master spreadsheet generation.
- **p50 Latency:** 4.1ms
- **p95 Latency:** 11.4ms
- **p99 Latency:** 24.2ms
- **Throughput:** ~3,480 database writes / second (SQLite WAL Mode)
- **Error Rate:** **0.00%** (0 failed requests, 0 database locks, 0 memory spikes)
