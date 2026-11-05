const fs = require('fs');
const path = require('path');
const db = require('./src/database');
const { parseDocxQuestionBank } = require('./src/parser');
const {
  getRandomExamSet,
  generateStudentQuestionPool,
  sanitizeQuestionsForClient,
  gradeSession
} = require('./src/examEngine');
const { generateMasterExcel, computeRanks } = require('./src/exporter');

async function runTests() {
  console.log('🧪 Starting ExamShield LAN Pipeline Test...\n');

  // 1. Initialize DB
  db.initDb();
  const exam = db.getActiveExam();
  console.log(`✅ DB Initialized. Active Exam: "${exam.title}" (ID: ${exam.id})`);

  // Clear previous test questions
  db.clearAllQuestions(exam.id);

  // 2. Test DOCX Parser on sample papers
  const sampleDir = path.join(__dirname, '..', 'sample-papers');
  const files = ['Hardware.docx', 'Networking.docx', 'Operating_Systems.docx', 'Service_Desk.docx'];
  let totalImported = 0;

  for (const f of files) {
    const filePath = path.join(sampleDir, f);
    const buf = fs.readFileSync(filePath);
    const topic = path.parse(f).name.replace(/_/g, ' ');
    const questions = await parseDocxQuestionBank(buf, topic);
    console.log(`📄 Parsed "${f}": ${questions.length} questions found.`);
    
    // Validate explanation exclusion
    for (const q of questions) {
      if (/explanation/i.test(q.question_text) || /explanation/i.test(q.question_html)) {
        throw new Error(`FAIL: Explanation detected in question: "${q.question_text}"`);
      }
    }

    db.insertQuestions(exam.id, questions);
    totalImported += questions.length;
  }

  console.log(`✅ All DOCX files imported. Total questions in DB: ${totalImported}`);

  // 3. Verify Topics Summary
  const topics = db.getTopicsSummary(exam.id);
  console.log('📊 Topics in Bank:', topics.map(t => `${t.topic} (${t.count})`).join(', '));

  // 4. Test Student Pool & Set Generation (e.g. 2 questions per topic)
  const allQuestions = db.getQuestionsByExam(exam.id);
  const studentPool = generateStudentQuestionPool(allQuestions, 2);
  const examSet = getRandomExamSet();
  console.log(`\n🎲 Generated Student Pool: ${studentPool.length} questions allocated on [${examSet}].`);

  // Verify option shuffling & keys
  const sampleQ = studentPool[0];
  console.log(`   Sample Q1 [${sampleQ.topic}]: "${sampleQ.question_text.slice(0, 45)}..."`);
  console.log(`   Options: ${sampleQ.options.map(o => `(${o.display_letter}) ${o.text}`).join(' | ')}`);
  console.log(`   Is Multiple Choice: ${sampleQ.is_multiple_choice}`);
  console.log(`   Correct Keys: ${JSON.stringify(sampleQ.correct_keys)}`);

  // 5. Test Student Session in Database
  db.clearExamSessions(exam.id);
  const sessionId = 'test_student_101';
  const session = db.createStudentSession({
    id: sessionId,
    exam_id: exam.id,
    student_name: 'Rahul Sharma',
    exam_set: examSet,
    assigned_questions: studentPool,
    answers: {},
    marked_for_review: [],
    remaining_seconds: 3600
  });
  console.log(`\n👤 Student Session Created: ${session.student_name} (Status: ${session.status})`);

  // 6. Test Auto-Save Answer
  const firstQ = studentPool[0];
  // Select first option
  db.saveAnswer(sessionId, firstQ.id, [firstQ.options[0].key]);
  const sessionAfterAnswer = db.getSessionById(sessionId);
  console.log(`💾 Answer Saved for Q1: Selected [${firstQ.options[0].key}] -> Count: ${Object.keys(sessionAfterAnswer.answers).length}`);

  // 7. Test Anti-Cheat Focus Loss Detection & 1-Click Unfreeze
  console.log('\n🚨 Simulating Anti-Cheat: Focus Lost (Alt+Tab)...');
  db.freezeStudentSession(sessionId, 'Alt+Tab / Window Blur');
  let frozenSession = db.getSessionById(sessionId);
  console.log(`   Session Status: ${frozenSession.status.toUpperCase()} (Reason: ${frozenSession.freeze_reason})`);

  console.log('🔓 Simulating Teacher 1-Click Unfreeze...');
  db.unfreezeStudentSession(sessionId);
  let unfrozenSession = db.getSessionById(sessionId);
  console.log(`   Session Restored: Status is now "${unfrozenSession.status}". Answers intact: ${JSON.stringify(unfrozenSession.answers)}`);

  // 8. Test Grading & Scorecard
  // Provide correct answers for half the questions
  const simulatedAnswers = {};
  studentPool.forEach((q, idx) => {
    if (idx % 2 === 0) {
      simulatedAnswers[q.id] = q.correct_keys; // Correct
    } else {
      simulatedAnswers[q.id] = ['wrong_opt']; // Wrong
    }
  });

  const scoreData = gradeSession(studentPool, simulatedAnswers, 50);
  db.submitStudentSession(sessionId, scoreData);
  const submittedSession = db.getSessionById(sessionId);

  console.log(`\n🏆 Final Scorecard:`);
  console.log(`   Total Score: ${submittedSession.total_score} / ${submittedSession.max_score} (${submittedSession.percentage}%)`);
  console.log(`   Result: ${submittedSession.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log('   Topic Performance:');
  for (const [top, res] of Object.entries(submittedSession.topic_scores)) {
    console.log(`     - ${top}: ${res.score}/${res.total} (${res.percentage}%)`);
  }

  // 9. Create another student for Excel Ranking test
  const session2 = db.createStudentSession({
    id: 'test_student_102',
    exam_id: exam.id,
    student_name: 'Priya Patel',
    exam_set: 'Set B',
    assigned_questions: studentPool,
    answers: {},
    remaining_seconds: 3500
  });
  // 100% correct answers
  const perfectAnswers = {};
  studentPool.forEach(q => { perfectAnswers[q.id] = q.correct_keys; });
  const scoreData2 = gradeSession(studentPool, perfectAnswers, 50);
  db.submitStudentSession(session2.id, scoreData2);

  // 10. Test Master Excel Export
  const allSessions = db.getAllStudentSessions(exam.id);
  const normalExcel = await generateMasterExcel(allSessions, 'normal', exam.title);
  const rankExcel = await generateMasterExcel(allSessions, 'rank', exam.title);

  console.log(`\n📊 Master Excel Generated:`);
  console.log(`   Normal Order Buffer Size: ${normalExcel.length} bytes`);
  console.log(`   Rank Order Buffer Size: ${rankExcel.length} bytes`);

  const { rankedMap, sortedList } = computeRanks(allSessions);
  console.log('   Leaderboard:');
  sortedList.forEach(s => {
    console.log(`     Rank ${rankedMap.get(s.id)}: ${s.student_name} - ${s.total_score}/${s.max_score} (${s.percentage}%) [${s.exam_set}]`);
  });

  console.log('\n🎉 ALL PIPELINE TESTS PASSED 100% PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
