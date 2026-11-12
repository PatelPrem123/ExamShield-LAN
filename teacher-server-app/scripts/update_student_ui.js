const fs = require('fs');
const path = require('path');

const studentHtmlPath = path.join(__dirname, '..', 'src', 'public', 'index.html');
let content = fs.readFileSync(studentHtmlPath, 'utf8');

// 1. Add status badge in header
const oldBatchBadge = '<span id="joinBatchBadge" class="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 font-mono">🏷️ Batch: BATCH-01</span>';
const newBatchBadge = '<div class="flex items-center gap-2 flex-wrap"><span id="joinBatchBadge" class="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 font-mono">🏷️ Batch: BATCH-01</span><span id="joinExamStatusBadge" class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span><span id="joinExamStatusText">Live Test Ready</span></span></div>';

if (content.includes(oldBatchBadge)) {
  content = content.replace(oldBatchBadge, newBatchBadge);
}

// 2. Wrap start button text
if (content.includes('<span>Start Examination</span>')) {
  content = content.replace('<span>Start Examination</span>', '<span id="startBtnText">Start Examination</span>');
}

// 3. Insert waiting room and countdown overlay before examInterface
const waitingRoomMarker = '  <!-- 2. ACTIVE EXAM TEST INTERFACE (VCE STYLE) -->';
const waitingRoomHtml = `  <!-- ======================================================== -->
  <!-- 1.5. STUDENT WAITING ROOM SCREEN -->
  <!-- ======================================================== -->
  <div id="waitingScreen" class="flex-1 flex items-center justify-center p-4 py-8 hidden">
    <div class="glass-panel max-w-xl w-full p-6 sm:p-10 space-y-7 text-center relative overflow-hidden">
      <div class="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]"></div>

      <!-- Central Pulsing Cyber Radar -->
      <div class="radar-wrapper relative z-10">
        <div class="radar-ring"></div>
        <div class="radar-ring"></div>
        <div class="radar-ring"></div>
        <div class="radar-core">
          <svg class="w-7 h-7 drop-shadow-md animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        </div>
      </div>

      <!-- Status Header -->
      <div class="space-y-2 relative z-10">
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Live Synced With Teacher Console</span>
        </div>
        <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Waiting for Proctor to Start Exam
        </h2>
        <p class="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          You are securely registered in the batch room. The examination will launch automatically as soon as the proctor activates the test session.
        </p>
      </div>

      <!-- Candidate Ticket Card -->
      <div class="p-4 rounded-2xl border border-slate-700/60 bg-slate-900/70 text-left space-y-3 relative z-10 shadow-inner">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocated Ticket Details</span>
          <span id="waitingBatchBadge" class="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 font-bold border border-indigo-700 font-mono">🏷️ BATCH-01</span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span class="text-slate-500 block text-[10px] font-semibold uppercase">Candidate Name</span>
            <span id="waitingCandidateName" class="font-bold text-white text-sm">--</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px] font-semibold uppercase">Exam Paper Set</span>
            <span id="waitingExamSet" class="font-bold text-indigo-400 text-sm">Set Random</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px] font-semibold uppercase">Examination</span>
            <span id="waitingExamTitle" class="font-medium text-slate-300 truncate block">--</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px] font-semibold uppercase">Total Duration</span>
            <span id="waitingDuration" class="font-bold text-emerald-400">60 Minutes</span>
          </div>
        </div>
      </div>

      <!-- Diagnostics Checklist -->
      <div class="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold relative z-10">
        <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-emerald-400 flex flex-col items-center gap-1">
          <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
          <span>LAN Link Active</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-emerald-400 flex flex-col items-center gap-1">
          <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
          <span>Anti-Cheat Armed</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-emerald-400 flex flex-col items-center gap-1">
          <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
          <span>Fullscreen Ready</span>
        </div>
      </div>

      <p class="text-[11px] text-slate-500 relative z-10">
        Please do not close this browser tab. Refreshing is not required.
      </p>
    </div>
  </div>

  <!-- COUNTDOWN OVERLAY -->
  <div id="examCountdownOverlay" class="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center hidden">
    <div class="text-center space-y-4">
      <div class="text-xs font-black uppercase tracking-widest text-emerald-400 animate-pulse">Proctor Has Launched The Examination</div>
      <div id="countdownNumber" class="text-8xl sm:text-9xl font-black text-white tracking-tighter drop-shadow-[0_0_35px_rgba(99,102,241,0.8)] scale-100 transition-all duration-300">
        3
      </div>
      <div class="text-sm font-semibold text-slate-400">Arming Fullscreen & Proctoring...</div>
    </div>
  </div>\n\n`;

if (content.includes(waitingRoomMarker) && !content.includes('id="waitingScreen"')) {
  content = content.replace(waitingRoomMarker, waitingRoomHtml + waitingRoomMarker);
}

fs.writeFileSync(studentHtmlPath, content, 'utf8');
console.log('Student HTML updated successfully!');
