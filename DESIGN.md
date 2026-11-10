# 🎨 Design System & UX Specification (DESIGN.md) — ExamShield LAN

**Product:** ExamShield LAN  
**Version:** v2.5.16  
**Status:** Approved Production Design Standard  
**Lead Designer:** Antigravity Senior Product Designer & Design Systems Architect  

---

## 1. Visual Direction & Design Principles

### 1.1 Core Principles
1. **Focus & Calmness:** Examinations are inherently high-stress environments. The interface eliminates visual clutter, flashing animations, and non-essential widgets to keep candidate cognitive load entirely on question comprehension.
2. **High-Contrast Clarity:** Clear distinction between answered, unanswered, and flagged questions. High visual contrast ratios (`≥ 4.5:1`) ensure readability on institutional TN/IPS computer monitors.
3. **Luminescent Modernism:** Uses subtle glassmorphism (`backdrop-filter: blur`), crisp slate borders (`#e2e8f0` / `#334155`), and targeted micro-interactions rather than heavy skeuomorphism.
4. **Zero-Ambiguity Statuses:** Every proctoring state (Active, Waiting, Frozen, Submitted) has dedicated semantic color coding and icon indicators so instructors can assess an entire classroom in under 2 seconds.

---

## 2. Color System & Typography

### 2.1 Color Palette Tokens

| Semantic Token | Light Mode (HEX / Class) | Dark Mode (HEX / Class) | Usage / Intent |
|---|---|---|---|
| **Primary Brand** | `#4f46e5` (`indigo-600`) | `#6366f1` (`indigo-400`) | Primary actions, branding, selected tabs, active question borders |
| **Success / Passed** | `#059669` (`emerald-600`) | `#34d399` (`emerald-400`) | Passed scores, right answers, server online status, start buttons |
| **Danger / Alarm** | `#e11d48` (`rose-600`) | `#f43f5e` (`rose-500`) | Security freeze alerts, wrong answers, failed status, stop buttons |
| **Warning / Review** | `#d97706` (`amber-600`) | `#fbbf24` (`amber-400`) | Marked for review, waiting room status, time warning (< 5m) |
| **Background Base** | `#f8fafc` (`slate-50`) | `#0f172a` (`slate-900`) | Global page background |
| **Surface / Card** | `#ffffff` (`bg-white`) | `#1e293b` (`slate-800`) | Card containers, modals, question boxes, header bar |
| **Border Neutral** | `#e2e8f0` (`slate-200`) | `#334155` (`slate-700`) | Dividers, card boundaries, table cell borders |
| **Text Primary** | `#0f172a` (`slate-900`) | `#f8fafc` (`slate-50`) | Main headings, question stems, primary labels |
| **Text Secondary** | `#64748b` (`slate-500`) | `#94a3b8` (`slate-400`) | Timestamps, question counts, helper subtext |

### 2.2 Typography Scale
- **Font Family:** Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif.
- **Monospace Family:** JetBrains Mono, "Fira Code", Consolas, monospace (used for timers, scores, IP addresses, candidate tokens, and roll numbers).
- **Type Hierarchy:**
  - `Display / H1:` `28px – 32px` (`text-2xl sm:text-3xl`), font-black (`font-900`), letter-spacing `-0.025em`.
  - `Section / H2:` `20px – 24px` (`text-xl sm:text-2xl`), font-bold (`font-700`), letter-spacing `-0.02em`.
  - `Card Header / H3:` `14px – 16px` (`text-sm sm:text-base`), font-bold (`font-700`), uppercase tracking-wider.
  - `Body / Question Stem:` `15px – 17px` (`text-base sm:text-lg`), font-medium (`font-500`), line-height `1.6`.
  - `Option Label:` `14px – 15px` (`text-sm sm:text-base`), font-normal (`font-400`).
  - `Caption / Badge:` `11px – 12px` (`text-xs`), font-bold (`font-700`), uppercase tracking-widest.

---

## 3. Layout Grid & Spacing System

- **Container Widths:**
  - Student Exam Interface: Max width `1152px` (`max-w-6xl`), centered with `mx-auto`, responsive padding `px-4 sm:px-6`.
  - Teacher Control Center: Max width `1280px` (`max-w-7xl`), centered with `mx-auto`, responsive padding `px-4 sm:px-8`.
  - Student Login Card: Max width `480px` (`max-w-md`), centered viewport.
  - Student Scorecard Card: Max width `576px` (`max-w-xl`), centered viewport.
- **Spacing Scale:** Standard 4px baseline (`p-1` = 4px, `p-2` = 8px, `p-3` = 12px, `p-4` = 16px, `p-6` = 24px, `p-8` = 32px).

---

## 4. Reusable UI Components

### 4.1 Buttons & Interactive Controls
- **Primary CTA (`.btn-shimmer`):** Gradient-accented button with light-sweep CSS keyframe animation (`linear-gradient(90deg, ...)`) to guide user attention to primary forward steps.
- **Secondary Action:** Ghost / border button (`border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800`), font-bold text.
- **Destructive Button:** Red badge styling (`bg-rose-500 hover:bg-rose-600 text-white`), requiring confirmation modals for irreversible proctoring commands (e.g., Force Submit, Stop Exam).

### 4.2 Badges & Chips
- **Status Badges (`.badge-status`):** Pill-shaped (`rounded-full`), `px-2.5 py-0.5`, `text-[10px]` to `text-xs`, font-mono / font-bold.
  - Active: Emerald green background + emerald text + pulse dot.
  - Waiting: Amber background + amber text.
  - Frozen: Rose red background + rose text + animated lock icon.
  - Submitted: Slate blue background + slate text.
- **Distinction Shimmer Badge (`#resultDistinctionBadge`):** Golden metallic shimmer (`gold-shimmer-badge`) dynamically displayed **only** when candidate achieves `percentage >= 80% && passed`.

### 4.3 Question Palette
- **Cell Size:** `36px × 36px` to `40px × 40px`, rounded square (`rounded-xl`).
- **Visual State Logic:**
  - `Current Question:` Active ring outline (`ring-2 ring-indigo-500 ring-offset-2`).
  - `Answered:` Solid emerald green fill (`bg-emerald-500 text-white font-bold`).
  - `Marked for Review:` Solid amber orange fill (`bg-amber-500 text-white font-bold`).
  - `Marked & Answered:` Split or dual indicator (amber with checkmark indicator).
  - `Unattempted:` Neutral gray outline (`bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300`).

---

## 5. Screen Layout & Navigation Architecture

### 5.1 Teacher Control Center Navigation
- **Navigation Bar:** Horizontal drag-to-scroll, wheel-scrollable track with zero layout shift.
- **Tabs:**
  1. `Live Monitor:` Classroom grid overview, live timers, quick unfreeze.
  2. `Question Bank:` Word `.docx` import, questions table, diagram viewer.
  3. `Exam Settings:` Duration, pass mark, marking scheme toggles.
  4. `Batch Manager:` Shift partitions, active batch switch.
  5. `Results & Reports:` Podium cards, 13-column results table, CSV/Excel exports.

### 5.2 Results Table Architecture
- Column structure configured with rigid responsive widths:
  - `Rank:` `w-12`, centered.
  - `Candidate Name:` Dynamic flex with font-bold.
  - `Paper Mode:` Centered badge (`🎲 Random`).
  - `Score:` Centered score badge.
  - `Right (✓):` Emerald text centered (`px-2`).
  - `Wrong (✗):` Rose text centered (`px-2`).
  - `Percentage:` Centered font-mono.
  - `Status:` Centered badge (PASSED/FAILED).
  - `Violations:` Red alert pill or green clean badge.
  - `Topic Breakdown:` Constrained to `max-w-[200px]` with mini progress bars.
  - `Submitted Time:` Centered `11px` monospace timestamp.

---

## 6. Feedback, Animations & Celebrations

### 6.1 Instant Score Radial Gauge Animation
- **SVG Circular Progress:** `stroke-dasharray: 565`, smooth countup transition (`1500ms`) using exponential easing (`1 - Math.pow(2, -10 * progress)`).
- **Dynamic Ring Colors:**
  - Passed: Emerald gradient stroke (`#10b981`).
  - Failed: Rose red stroke (`#f43f5e`).

### 6.2 Dual-Stage Confetti Explosion
- **Canvas Overlay (`#confetti-canvas`):** Layered above modal stack with `z-index: 9999`, pointer-events disabled.
- **Burst Sequence:**
  - *Stage 1:* Immediate burst of 200 colorful micro-particles when score gauge completes its 1500ms countup.
  - *Stage 2:* Sustained secondary celebratory wave 350ms later for high visual polish.

---

## 7. Accessibility (A11y) & Usability Standards

1. **Color Contrast:** All body text meets WCAG AA standard (`4.5:1` minimum). Monospace codes meet AAA where possible.
2. **Keyboard Navigation:** Full test navigation accessible via keyboard (`Enter` to submit, `Tab` between options, Arrow keys for radio selection).
3. **Esc Key Interception:** Pressing `Escape` does not trap the candidate or freeze the test; it safely adjusts fullscreen transitions without proctor lockouts.
4. **Dark & Light Mode Harmony:** Both themes are built into pure CSS custom properties with zero external asset downloading, guaranteeing instantaneous theme switching.
