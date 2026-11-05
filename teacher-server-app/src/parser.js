let _mammoth = null;
function getMammoth() {
  if (!_mammoth) {
    _mammoth = require('mammoth');
  }
  return _mammoth;
}

/**
 * Converts a DOCX buffer to HTML with embedded Base64 images.
 */
async function docxBufferToHtml(buffer) {
  const mammoth = getMammoth();
  const options = {
    convertImage: mammoth.images.imgElement(async (image) => {
      const imageBuffer = await image.read('base64');
      return {
        src: `data:${image.contentType};base64,${imageBuffer}`
      };
    })
  };

  const result = await mammoth.convertToHtml({ buffer }, options);
  return result.value;
}

/**
 * Strips HTML tags to get pure plain text for pattern matching.
 */
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parses questions from DOCX HTML output.
 * Fully supports:
 * - Single-answer: Answer: C (single) or Answer: C
 * - Multiple-answer: Answer: B, C (multiple) or Answer: B, C
 * - Embedded Base64 images in questions and options
 * - Complete exclusion of explanations
 * - Multiple topics (from "Topic: ..." in doc or fallback to filename)
 */
async function parseDocxQuestionBank(buffer, defaultTopic = 'General') {
  const rawHtml = await docxBufferToHtml(buffer);

  // Split HTML into paragraphs/blocks (<p>, <h1>, <h2>, <h3>, <li>, <div>)
  // We keep the HTML tags inside each block
  const blockRegex = /<(p|h[1-6]|li|div)[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks = [];
  let match;

  while ((match = blockRegex.exec(rawHtml)) !== null) {
    const innerHtml = match[2].trim();
    if (innerHtml) {
      blocks.push(innerHtml);
    }
  }

  // If regex found no blocks, fallback to splitting by newlines
  if (blocks.length === 0) {
    const rawLines = rawHtml.split(/<br\s*\/?>|\n+/i);
    for (const line of rawLines) {
      if (line.trim()) blocks.push(line.trim());
    }
  }

  const questions = [];
  let currentTopic = defaultTopic;
  let currentQuestion = null;
  let inExplanation = false;

  const isQuestionStart = (text) => {
    // Matches "1. ", "Q1. ", "Question 1:", "1) ", "Q1: ", etc.
    return /^(?:question\s*\d+|q\d+[\.:\)]|\d+[\.:\)])\s+/i.test(text);
  };

  const isOption = (text) => {
    // Matches "A. ", "A) ", "[A] ", "(A) ", "A: "
    return /^(?:\[?[A-E]\]?[\.:\)]|\([A-E]\))\s+/i.test(text);
  };

  const isAnswer = (text) => {
    return /^answer\s*:/i.test(text);
  };

  const isExplanation = (text) => {
    return /^(?:explanation|solution|reason)\s*:/i.test(text);
  };

  const isTopicHeader = (text) => {
    return /^topic\s*:\s*(.+)$/i.test(text);
  };

  function finalizeQuestion(q) {
    if (!q) return;
    if (!q.question_html || q.options.length < 2) return;

    // Determine correct keys based on correct_letters
    const correctKeys = [];
    for (const opt of q.options) {
      if (q.correct_letters.includes(opt.letter.toUpperCase())) {
        correctKeys.push(opt.key);
      }
    }

    // Determine is_multiple_choice
    const isMultiple = q.explicit_multiple || q.correct_letters.length > 1;

    questions.push({
      topic: q.topic || currentTopic,
      question_number: q.question_number,
      question_text: stripHtml(q.question_html),
      question_html: q.question_html,
      options: q.options.map(opt => ({
        key: opt.key,
        letter: opt.letter,
        text: stripHtml(opt.html),
        html: opt.html
      })),
      correct_answers: q.correct_letters, // ['A'] or ['B', 'C']
      correct_keys: correctKeys,
      is_multiple_choice: isMultiple
    });
  }

  for (let i = 0; i < blocks.length; i++) {
    const blockHtml = blocks[i];
    const plainText = stripHtml(blockHtml);

    if (!plainText && !blockHtml.includes('<img')) {
      continue;
    }

    // Check for Topic Header: "Topic: Networking"
    const topicMatch = plainText.match(/^topic\s*:\s*(.+)$/i);
    if (topicMatch) {
      currentTopic = topicMatch[1].trim();
      continue;
    }

    // Check for Explanation start - MUST BE COMPLETELY EXCLUDED
    if (isExplanation(plainText)) {
      inExplanation = true;
      continue;
    }

    // Check if new Question starts
    if (isQuestionStart(plainText)) {
      inExplanation = false;
      finalizeQuestion(currentQuestion);

      const qNumMatch = plainText.match(/^(?:question\s*(\d+)|q(\d+)[\.:\)]|(\d+)[\.:\)])\s+(.*)/i);
      const qNum = qNumMatch ? parseInt(qNumMatch[1] || qNumMatch[2] || qNumMatch[3], 10) : (questions.length + 1);

      // Clean prefix from HTML
      let cleanHtml = blockHtml.replace(/^(?:<(?:strong|b|span|em)[^>]*>)?(?:question\s*\d+|q\d+[\.:\)]|\d+[\.:\)])\s*(?:<\/(?:strong|b|span|em)>)?/i, '').trim();
      if (!cleanHtml) cleanHtml = blockHtml;

      currentQuestion = {
        topic: currentTopic,
        question_number: qNum,
        question_html: cleanHtml,
        options: [],
        correct_letters: [],
        explicit_multiple: false
      };
      continue;
    }

    // If currently skipping explanation, ignore until next question
    if (inExplanation) {
      continue;
    }

    // If no active question yet, continue
    if (!currentQuestion) {
      continue;
    }

    // Check for Answer line: "Answer: C (single)" or "Answer: B, C (multiple)"
    if (isAnswer(plainText)) {
      const ansMatch = plainText.match(/^answer\s*:\s*([A-E,\s]+)(?:\((single|multiple)\))?/i);
      if (ansMatch) {
        const rawLetters = ansMatch[1];
        const mode = ansMatch[2] ? ansMatch[2].toLowerCase() : null;

        const letters = rawLetters
          .split(/[\s,]+/)
          .map(l => l.trim().toUpperCase())
          .filter(l => /^[A-E]$/.test(l));

        currentQuestion.correct_letters = letters;
        currentQuestion.explicit_multiple = mode === 'multiple' || letters.length > 1;
      }
      continue;
    }

    // Check for Option line: "A. Option text" or "B) Option text"
    if (isOption(plainText)) {
      const optLetterMatch = plainText.match(/^(?:\[?([A-E])\]?[\.:\)]|\(([A-E])\))\s+(.*)/i);
      const letter = optLetterMatch ? (optLetterMatch[1] || optLetterMatch[2]).toUpperCase() : 'A';

      // Clean prefix from option HTML
      let cleanOptHtml = blockHtml.replace(/^(?:<(?:strong|b|span|em)[^>]*>)?(?:\[?[A-E]\]?[\.:\)]|\([A-E]\))\s*(?:<\/(?:strong|b|span|em)>)?/i, '').trim();
      if (!cleanOptHtml) cleanOptHtml = blockHtml;

      const optKey = `opt_${currentQuestion.options.length}`;
      currentQuestion.options.push({
        key: optKey,
        letter: letter,
        html: cleanOptHtml
      });
      continue;
    }

    // If we have an active question but no options yet, append to question_html (e.g., extra paragraphs or diagrams)
    if (currentQuestion.options.length === 0) {
      currentQuestion.question_html += `<br/>${blockHtml}`;
      continue;
    }

    // If we have options already, append extra paragraphs to the last option (e.g., multiline option or option diagram)
    if (currentQuestion.options.length > 0 && currentQuestion.correct_letters.length === 0) {
      const lastOpt = currentQuestion.options[currentQuestion.options.length - 1];
      lastOpt.html += `<br/>${blockHtml}`;
    }
  }

  // Finalize the last question
  finalizeQuestion(currentQuestion);

  return questions;
}

module.exports = {
  parseDocxQuestionBank
};
