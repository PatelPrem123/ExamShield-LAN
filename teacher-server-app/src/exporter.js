let _ExcelJS = null;
function getExcelJS() {
  if (!_ExcelJS) {
    _ExcelJS = require('exceljs');
  }
  return _ExcelJS;
}

const { formatLocalTime, formatLocalDateTime } = require('./utils/dateUtils');

/**
 * Computes rankings for a list of student sessions.
 * Tie-breaking policy:
 * 1. Higher total_score
 * 2. Higher percentage
 * 3. Earlier submitted_at or start_time
 */
function computeRanks(sessions) {
  const sorted = [...sessions].sort((a, b) => {
    if (b.total_score !== a.total_score) {
      return b.total_score - a.total_score;
    }
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    const valA = a.submitted_at || a.start_time;
    const valB = b.submitted_at || b.start_time;
    const timeA = valA ? new Date(valA).getTime() : 0;
    const timeB = valB ? new Date(valB).getTime() : 0;
    const validA = isNaN(timeA) ? 0 : timeA;
    const validB = isNaN(timeB) ? 0 : timeB;
    return validA - validB;
  });

  let currentRank = 1;
  const rankedMap = new Map();

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.total_score === prev.total_score && curr.percentage === prev.percentage) {
        rankedMap.set(curr.id, rankedMap.get(prev.id));
      } else {
        currentRank = i + 1;
        rankedMap.set(curr.id, currentRank);
      }
    } else {
      rankedMap.set(sorted[0].id, 1);
    }
  }

  return { rankedMap, sortedList: sorted };
}

/**
 * Generates an Excel buffer for Master Student Results.
 * - Prominent styled title banner at top
 * - Bold table column headers with background
 * - Overall Percentage (%) included
 * - Individual topic percentages omitted (scores only)
 * - Exam Set and Status columns removed
 * 
 * @param {Array} sessions - Array of parsed student session objects
 * @param {string} sortMode - 'rank' or 'normal'
 * @param {string} examTitle - Title of the exam
 * @param {string} format - 'xlsx' or 'csv'
 * @returns {Promise<Buffer>} - Excel workbook or CSV buffer
 */
async function generateMasterExcel(sessions, sortMode = 'normal', examTitle = 'ExamShield LAN Examination', format = 'xlsx') {
  if (format === 'csv') {
    return generateMasterCsv(sessions, sortMode, examTitle);
  }
  const ExcelJS = getExcelJS();
  const { rankedMap, sortedList } = computeRanks(sessions);

  // Decide row ordering
  const orderedSessions = sortMode === 'rank' ? sortedList : sessions;

  // Gather unique topics present across all sessions
  const topicsSet = new Set();
  for (const s of sessions) {
    if (s.topic_scores) {
      for (const t of Object.keys(s.topic_scores)) {
        topicsSet.add(t);
      }
    }
  }
  const topics = Array.from(topicsSet).sort();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ExamShield LAN';
  wb.created = new Date();

  const sheetName = sortMode === 'rank' ? 'Rank-Sorted Results' : 'Master Results';
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // Table Column Headers (Exam Set and Status removed, topic % removed)
  const headers = [
    'Rank',
    'Student Name',
    'Score',
    'Max Marks',
    'Right Answers',
    'Wrong Answers',
    'Percentage (%)',
    'Result',
    'Violations'
  ];

  // Add individual topic columns (Score only, NO %)
  for (const topic of topics) {
    headers.push(topic);
  }

  headers.push('Started At');
  headers.push('Submitted At');

  const totalCols = headers.length;

  // 1. Title Banner (Row 1)
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'EXAMSHIELD LAN — EXAMINATION RESULTS REPORT';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } }; // Dark Indigo
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 34;

  // 2. Subtitle Details Banner (Row 2)
  ws.mergeCells(2, 1, 2, totalCols);
  const subCell = ws.getCell(2, 1);
  const orderLabel = sortMode === 'rank' ? 'Ranked Order (High to Low)' : 'Candidate Registration Order';
  subCell.value = `Examination: ${examTitle.toUpperCase()}   |   Report: ${orderLabel}   |   Exported: ${formatLocalDateTime(new Date())}`;
  subCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF312E81' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // Soft Indigo tint
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 22;

  // 3. Spacing Row (Row 3)
  ws.getRow(3).height = 8;

  // 4. Table Headers (Row 4 - BOLD!)
  const headerRow = ws.getRow(4);
  headerRow.height = 28;

  headers.forEach((h, idx) => {
    const colNum = idx + 1;
    const cell = headerRow.getCell(colNum);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; // BOLD
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; // Rich Indigo
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF6366F1' } },
      bottom: { style: 'medium', color: { argb: 'FF1E1B4B' } },
      left: { style: 'thin', color: { argb: 'FF6366F1' } },
      right: { style: 'thin', color: { argb: 'FF6366F1' } }
    };
  });

  // 5. Data Rows (Row 5+)
  orderedSessions.forEach((s, rowIdx) => {
    const rowNum = 5 + rowIdx;
    const isSubmitted = s.status === 'submitted';
    const rank = isSubmitted ? (rankedMap.get(s.id) || '-') : '-';

    const rowData = [
      rank,
      s.student_name,
      isSubmitted ? s.total_score : '-',
      isSubmitted ? s.max_score : (s.assigned_questions ? s.assigned_questions.length : '-'),
      isSubmitted ? (s.correct_count ?? 0) : '-',
      isSubmitted ? (s.wrong_count ?? 0) : '-',
      isSubmitted ? `${s.percentage}%` : '-',
      isSubmitted ? (s.passed ? 'PASSED' : 'FAILED') : (s.status === 'frozen' ? 'FROZEN' : 'IN PROGRESS'),
      s.violations_count ?? 0
    ];

    // Topic scores: Marks only, NO %
    for (const topic of topics) {
      const tData = s.topic_scores && s.topic_scores[topic];
      if (tData && isSubmitted) {
        rowData.push(`${tData.score} / ${tData.total}`);
      } else {
        rowData.push('-');
      }
    }

    // Timestamps
    rowData.push(s.start_time ? formatLocalTime(s.start_time) : '-');
    rowData.push(s.submitted_at ? formatLocalTime(s.submitted_at) : '-');

    const dataRow = ws.getRow(rowNum);
    dataRow.values = rowData;
    dataRow.height = 22;

    const isEven = rowIdx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC'; // Clean alternating rows

    rowData.forEach((val, cIdx) => {
      const colNum = cIdx + 1;
      const cell = dataRow.getCell(colNum);
      const isName = (colNum === 2);

      cell.alignment = { vertical: 'middle', horizontal: isName ? 'left' : 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (isName) {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
      } else if (colNum === 1) { // Rank
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF4338CA' } };
      } else if (colNum === 5) { // Right Answers
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF15803D' } }; // Green
      } else if (colNum === 6) { // Wrong Answers
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFB91C1C' } }; // Red
      } else if (colNum === 7) { // Percentage (%)
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      } else if (colNum === 8) { // Result
        if (val === 'PASSED') {
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF15803D' } }; // Green
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Soft green
        } else if (val === 'FAILED') {
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFB91C1C' } }; // Red
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Soft red
        } else {
          cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
        }
      } else {
        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF334155' } };
      }
    });
  });

  // Column widths
  const colWidths = [
    { width: 10 }, // Rank
    { width: 28 }, // Student Name
    { width: 12 }, // Score
    { width: 12 }, // Max Marks
    { width: 14 }, // Right Answers
    { width: 14 }, // Wrong Answers
    { width: 16 }, // Percentage (%)
    { width: 15 }, // Result
    { width: 14 }  // Violations
  ];

  for (let i = 0; i < topics.length; i++) {
    colWidths.push({ width: Math.max(16, topics[i].length + 4) });
  }

  colWidths.push({ width: 18 }); // Started At
  colWidths.push({ width: 18 }); // Submitted At

  ws.columns = colWidths;

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

/**
 * Generates clean CSV format with UTF-8 BOM (supported in all spreadsheet tools).
 */
function generateMasterCsv(sessions, sortMode = 'normal', examTitle = 'ExamShield LAN Examination') {
  const { rankedMap, sortedList } = computeRanks(sessions);
  const orderedSessions = sortMode === 'rank' ? sortedList : sessions;

  const topicsSet = new Set();
  for (const s of sessions) {
    if (s.topic_scores) {
      for (const t of Object.keys(s.topic_scores)) {
        topicsSet.add(t);
      }
    }
  }
  const topics = Array.from(topicsSet).sort();

  const headers = [
    'Rank',
    'Student Name',
    'Score',
    'Max Marks',
    'Right Answers',
    'Wrong Answers',
    'Percentage (%)',
    'Result',
    'Violations'
  ];

  for (const topic of topics) {
    headers.push(topic);
  }

  headers.push('Started At');
  headers.push('Submitted At');

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [];
  lines.push(`"EXAMSHIELD LAN — EXAMINATION RESULTS REPORT"`);
  lines.push(`"Examination: ${examTitle.toUpperCase()} | Sort: ${sortMode === 'rank' ? 'Ranked Order (High to Low)' : 'Candidate Order'} | Exported: ${formatLocalDateTime(new Date())}"`);
  lines.push('');
  lines.push(headers.map(escapeCsv).join(','));

  for (let i = 0; i < orderedSessions.length; i++) {
    const s = orderedSessions[i];
    const isSubmitted = s.status === 'submitted';
    const rank = isSubmitted ? (rankedMap.get(s.id) || '-') : '-';

    const row = [
      rank,
      s.student_name,
      isSubmitted ? s.total_score : '-',
      isSubmitted ? s.max_score : (s.assigned_questions ? s.assigned_questions.length : '-'),
      isSubmitted ? (s.correct_count ?? 0) : '-',
      isSubmitted ? (s.wrong_count ?? 0) : '-',
      isSubmitted ? `${s.percentage}%` : '-',
      isSubmitted ? (s.passed ? 'PASSED' : 'FAILED') : (s.status === 'frozen' ? 'FROZEN' : 'IN PROGRESS'),
      s.violations_count ?? 0
    ];

    for (const topic of topics) {
      const tData = s.topic_scores && s.topic_scores[topic];
      if (tData && isSubmitted) {
        row.push(`${tData.score} / ${tData.total}`);
      } else {
        row.push('-');
      }
    }

    row.push(s.start_time ? formatLocalTime(s.start_time) : '-');
    row.push(s.submitted_at ? formatLocalTime(s.submitted_at) : '-');

    lines.push(row.map(escapeCsv).join(','));
  }

  // Prepend UTF-8 BOM (0xEF, 0xBB, 0xBF) so Excel properly detects UTF-8
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  const content = Buffer.from(lines.join('\r\n'), 'utf8');
  return Buffer.concat([bom, content]);
}

module.exports = {
  generateMasterExcel,
  generateMasterCsv,
  computeRanks,
  formatLocalTime,
  formatLocalDateTime
};
