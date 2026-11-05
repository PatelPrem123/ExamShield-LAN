// ==============================================================================
// 🏷️  ExamShield LAN - Batch Management & Isolated Multi-Topic/Date Test Suite
// ==============================================================================

const path = require('path');
const fs = require('fs');
const http = require('http');

process.env.PORT = '3095';
const tempDbPath = path.join(require('os').tmpdir(), `examshield_batch_${Date.now()}.db`);
process.env.DB_PATH = tempDbPath;

const { app, server } = require('./src/server');
const db = require('./src/database');

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ PASS : ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL : ${message}`);
    failedCount++;
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runBatchTests() {
  console.log('\n==============================================================================');
  console.log('   🏷️  ExamShield LAN - Batch Management Test Suite');
  console.log('==============================================================================\n');

  try {
    // 1. Setup sample questions
    const exam = db.getActiveExam();
    db.insertQuestions(exam.id, [
      {
        topic: 'Networking',
        question_number: 1,
        question_text: 'What layer is IP on?',
        question_html: '<p>What layer is IP on?</p>',
        options: [
          { key: 'opt_a', letter: 'A', text: 'Physical' },
          { key: 'opt_b', letter: 'B', text: 'Network' }
        ],
        correct_keys: ['opt_b'],
        correct_answers: ['B'],
        is_multiple_choice: false
      },
      {
        topic: 'Operating Systems',
        question_number: 2,
        question_text: 'Which command lists files in Linux?',
        question_html: '<p>Which command lists files in Linux?</p>',
        options: [
          { key: 'opt_a', letter: 'A', text: 'dir' },
          { key: 'opt_b', letter: 'B', text: 'ls' }
        ],
        correct_keys: ['opt_b'],
        correct_answers: ['B'],
        is_multiple_choice: false
      }
    ]);

    // 2. Admin Login to acquire token
    const loginRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { pin: 'admin123' });

    assert(loginRes.status === 200 && loginRes.data.token, 'Teacher Admin Login returns auth token');
    const adminToken = loginRes.data.token;

    // 3. Verify Default Batch exists
    const batchesRes1 = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/teacher/batches',
      method: 'GET',
      headers: { 'x-admin-token': adminToken }
    });
    assert(batchesRes1.status === 200 && batchesRes1.data.batches.length >= 1, 'Default batch BATCH-01 exists');
    assert(batchesRes1.data.active_batch === 'BATCH-01', 'Default active batch is BATCH-01');

    // 4. Register Student "Rahul Sharma" in BATCH-01
    const regRes1 = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/student/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { student_name: 'Rahul Sharma' });

    assert(regRes1.status === 200 && regRes1.data.batch_code === 'BATCH-01', 'Student Rahul Sharma registered in BATCH-01');
    const student1SessionId = regRes1.data.session_id;
    const student1Token = regRes1.data.student_token;

    // Student 1 submits paper
    const q1 = regRes1.data.questions[0];
    const submitRes1 = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/student/submit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-student-token': student1Token
      }
    }, {
      session_id: student1SessionId,
      answers: { [q1.id]: ['opt_b'] }
    });
    assert(submitRes1.status === 200, 'Student Rahul Sharma submitted exam in BATCH-01');

    // 5. Create BATCH-02 and Activate It
    const createRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/teacher/batches/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken
      }
    }, {
      batch_code: 'BATCH-02',
      batch_name: 'Linux & OS Exam 2:00 PM Slot',
      set_active: true
    });
    assert(createRes.status === 200 && createRes.data.batch.batch_code === 'BATCH-02', 'Successfully created and activated BATCH-02');

    // 5b. Verify duplicate batch code is rejected with 400
    const dupRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/teacher/batches/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken
      }
    }, {
      batch_code: 'BATCH-02',
      batch_name: 'Duplicate Batch Attempt',
      set_active: false
    });
    assert(dupRes.status === 400 && dupRes.data.error.includes('already exists'), 'Duplicate batch code rejected with 400 and helpful guidance');

    // 6. Register SAME NAME "Rahul Sharma" in BATCH-02 (Must succeed without collision!)
    const regRes2 = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/student/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { student_name: 'Rahul Sharma' });

    assert(regRes2.status === 200 && regRes2.data.batch_code === 'BATCH-02', 'Same name "Rahul Sharma" successfully registered in BATCH-02 without collision');
    assert(regRes2.data.is_reconnect === false, 'Registration in new batch is a fresh exam, not a reconnect');
    assert(regRes2.data.session_id !== student1SessionId, 'Generated isolated new session ID');

    // 7. Test Batch Filtering in /api/teacher/students
    // Query BATCH-01 filter
    const listBatch1 = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/teacher/students?batch=BATCH-01',
      method: 'GET',
      headers: { 'x-admin-token': adminToken }
    });
    assert(listBatch1.data.students.length === 1 && listBatch1.data.students[0].batch_code === 'BATCH-01', 'Filtering by BATCH-01 returns only candidates in BATCH-01');

    // Query BATCH-02 filter
    const listBatch2 = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/teacher/students?batch=BATCH-02',
      method: 'GET',
      headers: { 'x-admin-token': adminToken }
    });
    assert(listBatch2.data.students.length === 1 && listBatch2.data.students[0].batch_code === 'BATCH-02', 'Filtering by BATCH-02 returns only candidates in BATCH-02');

    // Query All Batches filter
    const listAll = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/teacher/students?batch=all',
      method: 'GET',
      headers: { 'x-admin-token': adminToken }
    });
    assert(listAll.data.students.length === 2, 'Querying ?batch=all returns candidates across all batches (Count: 2)');

    // 8. Delete BATCH-02
    const delRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/teacher/batches/BATCH-02',
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken }
    });
    assert(delRes.status === 200 && delRes.data.success, 'DELETE /api/teacher/batches/BATCH-02 successfully removes the batch and its sessions');

    // Verify after deletion
    const listAllAfterDel = await makeRequest({
      hostname: '127.0.0.1',
      port: 3095,
      path: '/api/teacher/students?batch=all',
      method: 'GET',
      headers: { 'x-admin-token': adminToken }
    });
    assert(listAllAfterDel.data.students.length === 1, 'BATCH-02 candidates purged, BATCH-01 candidate preserved intact');

    console.log('\n==============================================================================');
    console.log('   BATCH MANAGEMENT TEST SUMMARY');
    console.log('==============================================================================');
    console.log(`  Total Tests Run : ${passedCount + failedCount}`);
    console.log(`  Tests Passed    : ${passedCount}`);
    console.log(`  Tests Failed    : ${failedCount}`);
    console.log('==============================================================================\n');

    if (failedCount === 0) {
      console.log('🎉 ALL BATCH MANAGEMENT TESTS PASSED WITH 100% SUCCESS!\n');
    }

  } finally {
    server.close();
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch (e) {}
  }
}

runBatchTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
