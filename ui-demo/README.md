# ExamShield LAN - Modern UI & Animation Showcase (Demo Version)

This demo is an **isolated prototype** created to preview and test modern UI animations inspired by **Animmaster Lib**, **Skiper UI**, and **Vengeance UI** adapted specifically for **ExamShield LAN**.

---

## 🛡️ Key Features Demonstrated

### 1. Student Login (Animmaster Lib Style)
- **Neon Focused Inputs:** Multi-layered soft glow border and subtle lift on focus.
- **Light-Sweep Shimmer Button:** Smooth gradient sheen on hover and click for the primary CTA.
- **Zero-Lag CSS3:** 100% GPU accelerated, 0ms input latency on low-spec lab terminals.

### 2. Waiting Room & Radar Pulse (Teacher Start/Stop Integration)
- **Live Sonar/Radar Animation:** Concentric emerald pulse rings centered around a glowing connection core.
- **Heartbeat Ping Dot:** Live pulse indicator confirming network connectivity to the teacher server.
- **3-2-1 Countdown Overlay:** When the teacher starts the exam, a dramatic 3-2-1 flip animation counts down before launching the exam.

### 3. Live Examination Room (Vengeance UI + Skiper UI Style)
- **Buttery Question Transitions:** Slide-left / slide-right animations with fade when navigating questions or clicking palette numbers.
- **Vengeance Floating Tooltips:** Hovering over any question number in the palette reveals a spring-physics floating tooltip showing question status (Answered, Current, Pending).
- **Interactive Option Cards:** Hover lift with accent border and animated radio state selection.
- **Dynamic Progress Bar:** Real-time animated filling with glowing leading edge as answers are marked.

### 4. Post-Exam Scorecard & Results
- **Smooth Number Counter:** Final score animates from `0%` to `88%` with an `easeOutExpo` curve.
- **Synchronized SVG Radial Ring:** The progress ring strokes smoothly in sync with the counter.
- **Gold Shimmer Rank Badge:** Perpetual light sweep across the distinction badge.
- **Celebration Confetti:** Ultra-lightweight HTML5 Canvas confetti explosion on exam pass.

### 5. Teacher Control Center (Skiper UI Style)
- **Master Start/Stop Exam Switch:** Toggle between "EXAM LOCKED (WAITING ROOM)" and "EXAM LIVE".
- **Live Student Cards:**
  - **Safe State:** Subtle breathing green outline indicating normal active test-taking.
  - **Cheating Alert State (Alt+Tab):** Dynamic pulsing red border with camera-shake alert and violation badge.
- **Animated Metric Counters:** Smooth roll-up of connected workstations, active tests, violations, and average scores.
- **Interactive Simulation Controls:** Test cheating triggers and audio feedback with one click.

---

## 🚀 How to Run the Demo

1. Open File Explorer to:
   `C:\Users\Administrator\.gemini\antigravity\worktrees\ExamShield LAN\examshield_ui_demo_branch\ui-demo\`
2. Double-click **`open-demo.bat`** (or open **`index.html`** in any web browser).
3. Use the top navigation bar to switch between all 5 screens and test the interactive triggers.

---

## 🔒 Safety & Isolation Note
- All existing core files (`teacher-server-app`, `student-client-app`, `.exe` binaries) remain completely untouched.
- Everything is hosted inside the isolated branch `examshield_ui_demo_branch`.
- No commits or pushes have been made to GitHub or the `main` branch.
