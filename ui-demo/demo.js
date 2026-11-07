/* ==========================================================================
   ExamShield LAN - Interactive UI Demo Controller
   ========================================================================== */

// --- Audio Synthesizer (Zero External Audio Files Required) ---
const SoundFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  },
  playBeep(freq = 600, type = 'sine', duration = 0.15, gainVal = 0.1) {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio not permitted or unavailable
    }
  },
  playSuccess() {
    this.playBeep(523.25, 'sine', 0.12, 0.08); // C5
    setTimeout(() => this.playBeep(659.25, 'sine', 0.15, 0.08), 100); // E5
    setTimeout(() => this.playBeep(783.99, 'sine', 0.25, 0.1), 200); // G5
  },
  playAlert() {
    this.playBeep(440, 'sawtooth', 0.18, 0.12);
    setTimeout(() => this.playBeep(330, 'sawtooth', 0.25, 0.12), 150);
  },
  playTick() {
    this.playBeep(880, 'triangle', 0.05, 0.05);
  }
};

// --- Confetti Cannon Particles ---
const Confetti = {
  canvas: null,
  ctx: null,
  particles: [],
  animId: null,
  init() {
    this.canvas = document.getElementById('confetti-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },
  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },
  fire(count = 120) {
    if (!this.canvas) this.init();
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: this.canvas.height / 2 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 14 - 6,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1
      });
    }
    if (!this.animId) {
      this.render();
    }
  },
  render() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45; // gravity
      p.vx *= 0.98; // friction
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.007;

      if (p.opacity <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = Math.max(0, p.opacity);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this.render());
    } else {
      this.animId = null;
    }
  }
};

// --- Question Dataset for Live Exam Screen ---
const SampleQuestions = [
  {
    id: 1,
    title: "Operating Systems & Concurrency",
    text: "Which scheduling algorithm provides the minimum average waiting time for a given set of processes with known CPU burst times?",
    options: [
      "Round Robin (RR) with dynamic time quantum",
      "Shortest Job First (SJF / Shortest Remaining Time)",
      "First-Come, First-Served (FCFS)",
      "Multi-Level Priority Queuing"
    ],
    selected: 1 // default answer
  },
  {
    id: 2,
    title: "Computer Networks & Security",
    text: "In an offline LAN exam environment, which protocol prevents ARP poisoning and rogue gateway spoofing on managed switches?",
    options: [
      "Dynamic ARP Inspection (DAI) with DHCP Snooping binding table",
      "Border Gateway Protocol (BGP) with ASN filtering",
      "Spanning Tree Protocol (STP) in transparent bridge mode",
      "Network Address Translation (NAT) over VLAN Trunking"
    ],
    selected: null
  },
  {
    id: 3,
    title: "Database Management & ACID",
    text: "Which isolation level in SQL databases prevents dirty reads, non-repeatable reads, and phantom reads?",
    options: [
      "Read Committed",
      "Repeatable Read",
      "Serializable",
      "Snapshot Isolation without write skew prevention"
    ],
    selected: null
  },
  {
    id: 4,
    title: "Computer Architecture",
    text: "What mechanism is used by modern pipelined microprocessors to resolve control hazards caused by branch instructions?",
    options: [
      "Dynamic Branch Prediction with Branch Target Buffer (BTB)",
      "Direct Memory Access (DMA) burst arbitration",
      "Cache Coherency MESI Protocol",
      "Interrupt Vector Table lookups"
    ],
    selected: null
  },
  {
    id: 5,
    title: "Web Security & Sandboxing",
    text: "In a locked-down browser kiosk, which API event detects when an examinee shifts focus away from the test viewport window?",
    options: [
      "document.visibilitychange and window.onblur",
      "navigator.geolocation.watchPosition",
      "performance.getEntriesByType('resource')",
      "MutationObserver for CSS class mutations"
    ],
    selected: null
  }
];

// --- App State Controller ---
const ExamDemo = {
  currentScreen: 'login',
  currentQuestionIndex: 0,
  questions: JSON.parse(JSON.stringify(SampleQuestions)),
  examRunning: false,
  soundEnabled: true,

  init() {
    Confetti.init();
    this.bindEvents();
    this.renderQuestion();
    this.updateLiveProgress();
  },

  switchScreen(screenId) {
    document.querySelectorAll('.demo-screen').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.demo-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === screenId);
    });

    const target = document.getElementById(`screen-${screenId}`);
    if (target) {
      target.style.display = 'block';
      this.currentScreen = screenId;
    }

    if (screenId === 'scorecard') {
      this.triggerScorecardAnimation();
    } else if (screenId === 'teacher') {
      this.animateMetricCounters();
    }
  },

  bindEvents() {
    // Top Tabs
    document.querySelectorAll('.demo-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchScreen(btn.dataset.screen);
        if (this.soundEnabled) SoundFX.playTick();
      });
    });

    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    const themeLabel = document.getElementById('theme-label');
    const themeIcon = document.getElementById('theme-icon');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        document.documentElement.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        if (themeLabel) themeLabel.textContent = isLight ? 'Light' : 'Dark';
        if (themeIcon) {
          themeIcon.innerHTML = isLight
            ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
            : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
        }
        if (this.soundEnabled) SoundFX.playTick();
      });
    }

    // Sound Toggle
    const soundBtn = document.getElementById('sound-toggle-btn');
    const soundLabel = document.getElementById('sound-label');
    const soundIcon = document.getElementById('sound-icon');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        if (soundLabel) soundLabel.textContent = this.soundEnabled ? 'Audio On' : 'Audio Off';
        if (soundIcon) {
          soundIcon.innerHTML = this.soundEnabled
            ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>'
            : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
        }
        if (this.soundEnabled) SoundFX.playTick();
      });
    }

    // Login Form Submit -> Go to Waiting Room
    const loginBtn = document.getElementById('btn-student-login');
    if (loginBtn) {
      loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('student-name-input');
        const rollInput = document.getElementById('student-roll-input');
        if (nameInput && !nameInput.value.trim()) {
          nameInput.focus();
          return;
        }
        if (this.soundEnabled) SoundFX.playSuccess();
        this.switchScreen('waiting');
      });
    }

    // Waiting Room: Teacher Start Exam Simulation
    const triggerStartBtn = document.getElementById('btn-simulate-teacher-start');
    if (triggerStartBtn) {
      triggerStartBtn.addEventListener('click', () => {
        this.runCountdownAndStartExam();
      });
    }

    // Exam Screen Navigation
    const nextBtn = document.getElementById('btn-next-question');
    const prevBtn = document.getElementById('btn-prev-question');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextQuestion());
    }
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevQuestion());
    }

    // Submit Exam Button -> Go to Scorecard
    const submitExamBtn = document.getElementById('btn-submit-exam');
    if (submitExamBtn) {
      submitExamBtn.addEventListener('click', () => {
        this.switchScreen('scorecard');
      });
    }

    // Scorecard Retrigger Button
    const retriggerScorecardBtn = document.getElementById('btn-retrigger-scorecard');
    if (retriggerScorecardBtn) {
      retriggerScorecardBtn.addEventListener('click', () => {
        this.triggerScorecardAnimation();
      });
    }

    // Teacher Panel: Master Toggle
    const masterToggle = document.getElementById('teacher-master-toggle');
    if (masterToggle) {
      masterToggle.addEventListener('click', () => {
        this.examRunning = !this.examRunning;
        masterToggle.classList.toggle('active', this.examRunning);
        const statusText = document.getElementById('master-toggle-status');
        if (statusText) {
          statusText.innerHTML = this.examRunning
            ? '<span style="color:var(--success-color);font-weight:700;">● EXAM IN PROGRESS (LIVE)</span>'
            : '<span style="color:var(--text-muted);font-weight:700;">○ EXAM LOCKED (WAITING ROOM)</span>';
        }
        if (this.soundEnabled) {
          this.examRunning ? SoundFX.playSuccess() : SoundFX.playAlert();
        }
      });
    }

    // Teacher Panel: Simulate Alt+Tab Cheating Trigger
    const simulateCheatingBtn = document.getElementById('btn-simulate-violation');
    if (simulateCheatingBtn) {
      simulateCheatingBtn.addEventListener('click', () => {
        this.triggerSimulatedCheating();
      });
    }
  },

  runCountdownAndStartExam() {
    const overlay = document.getElementById('countdown-overlay');
    const countText = document.getElementById('countdown-display');
    if (!overlay || !countText) {
      this.switchScreen('exam');
      return;
    }

    overlay.classList.add('active');
    let count = 3;
    countText.textContent = count;
    if (this.soundEnabled) SoundFX.playTick();

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countText.textContent = count;
        countText.style.animation = 'none';
        void countText.offsetWidth; // trigger reflow
        countText.style.animation = 'countdown-pop 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        if (this.soundEnabled) SoundFX.playTick();
      } else if (count === 0) {
        countText.textContent = 'START!';
        countText.style.color = '#10b981';
        if (this.soundEnabled) SoundFX.playSuccess();
      } else {
        clearInterval(interval);
        overlay.classList.remove('active');
        this.switchScreen('exam');
      }
    }, 1000);
  },

  renderQuestion(direction = 'right') {
    const q = this.questions[this.currentQuestionIndex];
    const container = document.getElementById('question-display-area');
    if (!container) return;

    // Slide transition class
    const inClass = direction === 'right' ? 'slide-left-in' : 'slide-right-in';

    let optionsHtml = '';
    q.options.forEach((opt, idx) => {
      const isSelected = q.selected === idx;
      optionsHtml += `
        <div class="option-card ${isSelected ? 'selected' : ''}" data-opt-index="${idx}">
          <div class="option-radio"></div>
          <div style="flex:1;">
            <span style="font-weight:700;margin-right:8px;color:var(--brand-primary);">${String.fromCharCode(65 + idx)}.</span>
            <span>${opt}</span>
          </div>
        </div>
      `;
    });

    container.className = `question-card ${inClass}`;
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--brand-primary);background:rgba(99,102,241,0.12);padding:4px 10px;border-radius:6px;">
          Question ${this.currentQuestionIndex + 1} of ${this.questions.length}
        </span>
        <span style="font-size:13px;color:var(--text-muted);font-weight:500;">
          Category: ${q.title}
        </span>
      </div>
      <h3 style="font-size:18px;font-weight:700;line-height:1.5;margin-bottom:20px;color:var(--text-main);">
        ${q.text}
      </h3>
      <div class="options-group">
        ${optionsHtml}
      </div>
    `;

    // Bind Option Card clicks
    container.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        const optIdx = parseInt(card.dataset.optIndex, 10);
        this.selectOption(optIdx);
      });
    });

    this.renderPalette();
    this.updateLiveProgress();
  },

  selectOption(optIndex) {
    const q = this.questions[this.currentQuestionIndex];
    q.selected = optIndex;
    if (this.soundEnabled) SoundFX.playTick();
    this.renderQuestion('none');
  },

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.renderQuestion('right');
      if (this.soundEnabled) SoundFX.playTick();
    }
  },

  prevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.renderQuestion('left');
      if (this.soundEnabled) SoundFX.playTick();
    }
  },

  renderPalette() {
    const palette = document.getElementById('question-palette-container');
    if (!palette) return;

    let html = '';
    this.questions.forEach((q, i) => {
      const isCurrent = i === this.currentQuestionIndex;
      const isAnswered = q.selected !== null;
      let statusClass = '';
      let tooltipText = `Q${i + 1}: Not Visited`;

      if (isAnswered) {
        statusClass = 'answered';
        tooltipText = `Q${i + 1}: Answered (${String.fromCharCode(65 + q.selected)})`;
      }
      if (isCurrent) {
        statusClass += ' active';
        tooltipText = `Q${i + 1}: Currently Viewing`;
      }

      html += `
        <div class="tooltip-wrapper">
          <button class="palette-btn ${statusClass}" data-q-index="${i}">
            ${i + 1}
          </button>
          <div class="vengeance-tooltip">${tooltipText}</div>
        </div>
      `;
    });

    palette.innerHTML = html;

    palette.querySelectorAll('.palette-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.qIndex, 10);
        const direction = idx >= this.currentQuestionIndex ? 'right' : 'left';
        this.currentQuestionIndex = idx;
        this.renderQuestion(direction);
        if (this.soundEnabled) SoundFX.playTick();
      });
    });
  },

  updateLiveProgress() {
    const answeredCount = this.questions.filter(q => q.selected !== null).length;
    const total = this.questions.length;
    const pct = Math.round((answeredCount / total) * 100);

    const bar = document.getElementById('exam-progress-bar');
    const label = document.getElementById('exam-progress-label');
    if (bar) bar.style.width = `${pct}%`;
    if (label) label.textContent = `${answeredCount} of ${total} Answered (${pct}%)`;
  },

  triggerScorecardAnimation() {
    const targetScore = 88;
    const scoreText = document.getElementById('score-percentage-display');
    const scoreFill = document.getElementById('score-fill-ring');

    if (scoreText) scoreText.textContent = '0%';
    if (scoreFill) scoreFill.style.strokeDashoffset = '565';

    // Animate radial stroke ring
    setTimeout(() => {
      if (scoreFill) {
        const circumference = 565;
        const offset = circumference - (circumference * targetScore) / 100;
        scoreFill.style.strokeDashoffset = offset;
      }
    }, 150);

    // Number counting animation
    let current = 0;
    const duration = 1600;
    const start = performance.now();

    const countStep = (time) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      current = Math.round(ease * targetScore);
      if (scoreText) scoreText.textContent = `${current}%`;

      if (progress < 1) {
        requestAnimationFrame(countStep);
      } else {
        // Celebration confetti & sound!
        Confetti.fire(160);
        if (this.soundEnabled) SoundFX.playSuccess();
      }
    };

    requestAnimationFrame(countStep);
  },

  animateMetricCounters() {
    const counters = [
      { id: 'counter-connected', target: 48 },
      { id: 'counter-active', target: 47 },
      { id: 'counter-violations', target: 1 },
      { id: 'counter-avg-score', target: 84 }
    ];

    counters.forEach(item => {
      const el = document.getElementById(item.id);
      if (!el) return;
      let startVal = 0;
      const duration = 1200;
      const startTime = performance.now();

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const val = Math.round(ease * item.target);
        el.textContent = item.id === 'counter-avg-score' ? `${val}%` : val;
        if (progress < 1) {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    });
  },

  triggerSimulatedCheating() {
    const targetCard = document.getElementById('student-card-aman');
    const badge = document.getElementById('aman-violation-badge');
    const violationsCounter = document.getElementById('counter-violations');

    if (!targetCard) return;

    const isViolated = targetCard.classList.contains('status-violation');
    if (!isViolated) {
      targetCard.classList.remove('status-safe');
      targetCard.classList.add('status-violation');
      if (badge) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = '● Alt+Tab Out (2x)';
      }
      if (violationsCounter) violationsCounter.textContent = '2';
      if (this.soundEnabled) SoundFX.playAlert();
    } else {
      // Reset
      targetCard.classList.remove('status-violation');
      targetCard.classList.add('status-safe');
      if (badge) {
        badge.style.display = 'none';
      }
      if (violationsCounter) violationsCounter.textContent = '0';
      if (this.soundEnabled) SoundFX.playTick();
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  ExamDemo.init();
});
