/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 */
function shuffleArray(arr) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Assigns exam paper mode (no fixed sets, fully dynamic randomization).
 */
function getRandomExamSet() {
  return 'Random';
}

/**
 * Selects questions from the bank, performs 100% complete Fisher-Yates
 * randomization of question sequence for each student, and independently
 * shuffles options (A, B, C, D) for each question.
 */
function generateStudentQuestionPool(allQuestions, questionsPerTopic = 0) {
  let selectedQuestions = [];

  // If questionsPerTopic is specifically configured and smaller than available topic count, respect balance
  if (questionsPerTopic && questionsPerTopic > 0) {
    const topicMap = {};
    for (const q of allQuestions) {
      const topic = q.topic || 'General';
      if (!topicMap[topic]) topicMap[topic] = [];
      topicMap[topic].push(q);
    }

    let shouldFilter = false;
    for (const topic of Object.keys(topicMap)) {
      if (topicMap[topic].length > questionsPerTopic) {
        shouldFilter = true;
        break;
      }
    }

    if (shouldFilter) {
      for (const topic of Object.keys(topicMap)) {
        const topicQuestions = shuffleArray(topicMap[topic]);
        const takeCount = Math.min(topicQuestions.length, questionsPerTopic);
        selectedQuestions.push(...topicQuestions.slice(0, takeCount));
      }
    } else {
      selectedQuestions = [...allQuestions];
    }
  } else {
    // Take ALL questions from the bank
    selectedQuestions = [...allQuestions];
  }

  // 100% COMPLETE RANDOM QUESTION ORDER FOR THIS STUDENT
  const finalQuestions = shuffleArray(selectedQuestions);

  // Independently shuffle options for each question while preserving keys
  const assigned = finalQuestions.map((q, idx) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const originalOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
    const shuffledOptions = shuffleArray(originalOptions);

    const mappedOptions = shuffledOptions.map((opt, optIdx) => ({
      key: opt.key,
      display_letter: letters[optIdx] || String.fromCharCode(65 + optIdx),
      text: opt.text,
      html: opt.html
    }));

    return {
      index: idx + 1,
      id: q.id,
      topic: q.topic,
      question_number: q.question_number,
      question_text: q.question_text,
      question_html: q.question_html,
      is_multiple_choice: !!q.is_multiple_choice,
      options: mappedOptions,
      // Keep correct keys server-side for validation
      correct_keys: q.correct_keys || (typeof q.correct_answers_json === 'string' 
        ? JSON.parse(q.correct_answers_json) 
        : q.correct_answers)
    };
  });

  return assigned;
}

/**
 * Strips correct keys before sending assigned questions to the student client.
 */
function sanitizeQuestionsForClient(assignedQuestions) {
  return assignedQuestions.map(q => ({
    index: q.index,
    id: q.id,
    topic: q.topic,
    question_text: q.question_text,
    question_html: q.question_html,
    is_multiple_choice: q.is_multiple_choice,
    options: q.options.map(opt => ({
      key: opt.key,
      display_letter: opt.display_letter,
      text: opt.text,
      html: opt.html
    }))
  }));
}

/**
 * Grades a student session and calculates overall and topic-wise scores.
 * Supports Competitive Exam Mode (+4 for correct, -1 for wrong, 0 for unattempted).
 */
function gradeSession(assignedQuestions, studentAnswers, passingPercentage = 70, competitiveMode = false) {
  let correctCount = 0;
  let wrongCount = 0;
  let unattemptedCount = 0;

  let totalScore = 0;
  const isCompetitive = !!competitiveMode;
  const maxScore = isCompetitive ? (assignedQuestions.length * 4) : assignedQuestions.length;
  const topicBreakdown = {};

  for (const q of assignedQuestions) {
    const topic = q.topic || 'General';
    if (!topicBreakdown[topic]) {
      topicBreakdown[topic] = {
        score: 0,
        total: 0,
        percentage: 0,
        correct: 0,
        wrong: 0,
        unattempted: 0
      };
    }
    topicBreakdown[topic].total += isCompetitive ? 4 : 1;

    // Student selected keys for this question: e.g. ['opt_1'] or ['opt_0', 'opt_2']
    const selectedKeys = studentAnswers[q.id] || [];
    const correctKeys = q.correct_keys || [];

    if (!selectedKeys || selectedKeys.length === 0) {
      unattemptedCount += 1;
      topicBreakdown[topic].unattempted += 1;
      // 0 marks for unattempted
    } else {
      // Compare sets
      const isCorrect = arraysEqualAsSets(selectedKeys, correctKeys);
      if (isCorrect) {
        correctCount += 1;
        topicBreakdown[topic].correct += 1;
        const pts = isCompetitive ? 4 : 1;
        totalScore += pts;
        topicBreakdown[topic].score += pts;
      } else {
        wrongCount += 1;
        topicBreakdown[topic].wrong += 1;
        if (isCompetitive) {
          totalScore -= 1;
          topicBreakdown[topic].score -= 1;
        }
      }
    }
  }

  // Calculate percentages
  for (const topic of Object.keys(topicBreakdown)) {
    const t = topicBreakdown[topic];
    t.percentage = t.total > 0 ? parseFloat(((Math.max(0, t.score) / t.total) * 100).toFixed(1)) : 0;
  }

  const overallPercentage = maxScore > 0 ? parseFloat(((Math.max(0, totalScore) / maxScore) * 100).toFixed(1)) : 0;
  const passed = overallPercentage >= passingPercentage;

  const reviewQuestions = assignedQuestions.map(q => {
    const selectedKeys = studentAnswers[q.id] || [];
    const correctKeys = q.correct_keys || [];
    const isUnattempted = !selectedKeys || selectedKeys.length === 0;
    const isCorrect = !isUnattempted && arraysEqualAsSets(selectedKeys, correctKeys);

    let marksAwarded = 0;
    if (isCompetitive) {
      if (isCorrect) marksAwarded = 4;
      else if (isUnattempted) marksAwarded = 0;
      else marksAwarded = -1;
    } else {
      marksAwarded = isCorrect ? 1 : 0;
    }

    return {
      id: q.id,
      index: q.index,
      topic: q.topic,
      question_text: q.question_text,
      question_html: q.question_html,
      is_multiple_choice: q.is_multiple_choice,
      options: q.options,
      selected_keys: selectedKeys,
      correct_keys: correctKeys,
      is_correct: isCorrect,
      is_unattempted: isUnattempted,
      marks_awarded: marksAwarded
    };
  });

  return {
    total_score: totalScore,
    max_score: maxScore,
    percentage: overallPercentage,
    passed,
    correct_count: correctCount,
    wrong_count: wrongCount,
    unattempted_count: unattemptedCount,
    competitive_mode: isCompetitive,
    topic_scores: topicBreakdown,
    review_questions: reviewQuestions
  };
}

function arraysEqualAsSets(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
}

module.exports = {
  getRandomExamSet,
  generateStudentQuestionPool,
  sanitizeQuestionsForClient,
  gradeSession,
  arraysEqualAsSets
};
