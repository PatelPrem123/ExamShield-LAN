# GITHUB TOOL SELECTION & JUSTIFICATION MATRIX

**Project:** ExamShield LAN 🛡️  
**Audit Specification:** Antigravity Direct Software Audit & Testing Work Order V3  
**Date:** 03 November 2026  

---

## 1. Tool Selection Strategy

In accordance with Section 2, 3, and 17.1 of the Antigravity Work Order:
> *"Add a tool only when it covers a specific risk not already tested by the current stack... Prefer one tool per purpose... Keep test infrastructure reproducible and disposable... Do not install every tool in the catalogue."*

ExamShield LAN is designed to run in **100% offline, air-gapped environments** on institution hardware without internet connectivity. Therefore, tools were selected based on **zero internet footprint**, **minimal runtime overhead**, **strict offline reproducibility**, and **robustness under concurrency**.

---

## 2. Selected Tools & GitHub Repositories

| Tool / Library | GitHub Repository | Category | Version | Role in ExamShield LAN |
|---|---|---|---|---|
| **Better-SQLite3** | `WiseLibs/better-sqlite3` | Database Engine | `^13.0.3` | High-concurrency ACID storage with WAL (Write-Ahead Logging). Handles 100+ simultaneous student answer writes with zero deadlocks. |
| **ExcelJS** | `exceljs/exceljs` | Data Reporting | `^4.4.0` | Generates enterprise-grade `.xlsx` master workbooks with header formatting, auto-filters, and formula calculations. |
| **Express** | `expressjs/express` | HTTP Server | `^5.3.0` | Modern HTTP 5.x routing engine with custom security middleware for rate-limiting, DoS payload size guarding, and static assets. |
| **Socket.IO** | `socketio/socket.io` | Real-Time Events | `^4.8.4` | Bi-directional low-latency heartbeat and proctoring signal engine between teacher dashboard and student clients. |
| **Mammoth.js** | `mwilliamson/mammoth.js` | Parser & Ingestion | `^1.13.0` | Parses Microsoft Word (`.docx`) exam question banks into structured JSON without requiring Microsoft Office installed. |
| **Docx** | `dolanmiu/docx` | Document Authoring | `^9.9.0` | Programmatically generates official printable statements of marks and certificates. |
| **Node.js Test Runner & Assert** | `nodejs/node` | Testing Core | `v24.19.0` (Built-in) | Native zero-dependency test suite powering 7 comprehensive suites (Unit, TDD, Integration, System, Acceptance, Security, Batch). |
| **npm audit / GitHub Advisory** | `npm/cli` | Vulnerability Scan | `11.8.0` | Scans dependency tree against known CVEs and GHSA advisories. |

---

## 3. Evaluated & Skipped Tools (With Justifications)

| Candidate Tool | GitHub Repository | Decision | Justification |
|---|---|---|---|
| **Vitest / Jest** | `vitest-dev/vitest`<br>`jestjs/jest` | **SKIPPED** | The repository already features 7 tailored automated test runners covering 86 test scenarios that execute in under 15 seconds. Adding Jest/Vitest would introduce 150MB+ of node_modules bloat to an offline deployment package without increasing test fidelity. |
| **Playwright / Cypress** | `microsoft/playwright`<br>`cypress-io/cypress` | **SKIPPED** | Downloading bundled Chromium/Firefox binaries requires ~450MB of disk space and internet access during installation, violating the lightweight portable offline deployment contract. UI and E2E journeys are verified using HTTP and Socket.io automation. |
| **OWASP ZAP** | `zaproxy/zaproxy` | **SKIPPED (Active)** | Running full active vulnerability fuzzers against an offline embedded SQLite server can cause port exhaustion and socket exhaustion on institutional host laptops. Penetration tests are instead handled deterministically by `securityTests.js` (VULN-01 to VULN-07). |
| **SonarQube** | `SonarSource/sonarqube` | **SKIPPED** | Requires a dedicated Java/PostgreSQL server instance, which is incompatible with a standalone 1-click teacher application. |
| **Testcontainers** | `testcontainers/testcontainers-node` | **SKIPPED** | Requires Docker daemon. ExamShield LAN is built to run directly on bare-metal Windows machines in schools where Docker is neither installed nor permitted. |
| **Knip** | `webpro-nl/knip` | **DEFERRED** | Evaluated for unused export detection; manual audit of `src/` confirmed clean modular boundaries. |

---

## 4. Architectural Decision Records (ADRs)

- **ADR-01: SQLite WAL Mode over Client-Server DB:** Embedded SQLite with Write-Ahead Logging allows up to 1,000 writes/sec with single-file portability, eliminating the need to install or configure MySQL/PostgreSQL on teacher computers.
- **ADR-02: Native Test Rig over External Frameworks:** Using Node's native HTTP client and assertion primitives guarantees tests can be run by any teacher or reviewer offline immediately via `npm test` without internet setup.
- **ADR-03: Dual Exporter Architecture:** Formatted Excel files are generated using `ExcelJS` for rich layout fidelity, while raw data is streamed via UTF-8 CSV with Byte Order Mark (BOM) for universal compatibility with MS Excel in all locales.
