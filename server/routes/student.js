const express = require('express');
const router = express.Router();
const { get, run, all } = require('../db');

// Safe JSON parser helper for strings, arrays, objects, or comma-separated keys
function safeParseJSON(val, defaultVal = []) {
  if (typeof val === 'object' && val !== null) return val;
  if (!val) return defaultVal;
  try {
    return JSON.parse(val);
  } catch (err) {
    const str = val.toString().trim();
    if (str.includes(',')) return str.split(',').map(s => s.trim());
    return [str];
  }
}

// 100% Universal Robust Answer Matching Helper Function
function isAnswerCorrect(qType, optionsRaw, correctAnswersRaw, studentAnsRaw) {
  const optionsList = (safeParseJSON(optionsRaw, []) || []).map(o => o.toString().trim());
  const correctList = (safeParseJSON(correctAnswersRaw, []) || []).map(c => c.toString().trim());
  const studentList = (safeParseJSON(studentAnsRaw, []) || []).map(s => s.toString().trim());

  if (studentList.length === 0 || correctList.length === 0) return false;

  // Build acceptable set of answers (option text, letters A/B/C/D, indices)
  const acceptableSet = new Set();

  for (const corr of correctList) {
    const cStr = corr.trim();
    const cUpper = cStr.toUpperCase();

    acceptableSet.add(cStr.toLowerCase());

    if (['A', 'B', 'C', 'D'].includes(cUpper)) {
      const idx = cUpper.charCodeAt(0) - 65;
      if (optionsList[idx]) {
        acceptableSet.add(optionsList[idx].toLowerCase());
      }
      acceptableSet.add(cUpper);
    } else if (!isNaN(parseInt(cStr)) && parseInt(cStr) >= 0 && parseInt(cStr) < optionsList.length) {
      const idx = parseInt(cStr);
      if (optionsList[idx]) {
        acceptableSet.add(optionsList[idx].toLowerCase());
      }
      acceptableSet.add(String.fromCharCode(65 + idx));
    }
  }

  const typeLower = (qType || '').toString().toLowerCase();

  if (typeLower === 'multiple_choice' || typeLower === 'checkbox') {
    let matchCount = 0;
    for (const sChoice of studentList) {
      const sLower = sChoice.toLowerCase();
      const sUpper = sChoice.toUpperCase();
      let matched = acceptableSet.has(sLower);

      if (!matched) {
        if (['A', 'B', 'C', 'D'].includes(sUpper)) {
          const idx = sUpper.charCodeAt(0) - 65;
          if (optionsList[idx] && acceptableSet.has(optionsList[idx].toLowerCase())) {
            matched = true;
          }
        } else {
          const optIdx = optionsList.findIndex(o => o.toLowerCase() === sLower);
          if (optIdx !== -1) {
            const letter = String.fromCharCode(65 + optIdx);
            if (acceptableSet.has(letter)) matched = true;
          }
        }
      }
      if (matched) matchCount++;
    }
    const expectedCount = Math.min(correctList.length, optionsList.length);
    return matchCount >= expectedCount && studentList.length === expectedCount;
  } else {
    // Single choice / mcq / true_false / radio
    for (const sChoice of studentList) {
      const sLower = sChoice.toLowerCase();
      const sUpper = sChoice.toUpperCase();

      if (acceptableSet.has(sLower)) return true;

      // 1. If student choice is letter A, B, C, D -> map to option text
      if (['A', 'B', 'C', 'D'].includes(sUpper)) {
        const idx = sUpper.charCodeAt(0) - 65;
        if (optionsList[idx] && acceptableSet.has(optionsList[idx].toLowerCase())) {
          return true;
        }
      }

      // 2. If student choice is option text -> map to letter A, B, C, D
      const optIdx = optionsList.findIndex(o => o.toLowerCase() === sLower);
      if (optIdx !== -1) {
        const letter = String.fromCharCode(65 + optIdx);
        if (acceptableSet.has(letter)) return true;
      }
    }
    return false;
  }
}

// Verify session code and get registration form schema
router.get('/session-info/:code', async (req, res) => {
  try {
    const sessionCode = req.params.code.trim().toUpperCase();
    const session = await get(`
      SELECT s.*, e.title as exam_title, e.description, e.duration_minutes, e.passing_score,
             e.shuffle_questions, e.show_results_immediately
      FROM exam_sessions s
      JOIN exams e ON s.exam_id = e.id
      WHERE UPPER(s.session_code) = ?
    `, [sessionCode]);

    if (!session) {
      return res.status(404).json({ error: 'Invalid Session Code. Please check the code provided by the administrator.' });
    }

    if (session.status === 'draft') {
      return res.status(400).json({ error: 'This exam session has not been started yet. Please wait for the administrator.' });
    }

    if (session.status === 'paused') {
      return res.status(400).json({ error: 'This exam session is currently paused by the administrator.' });
    }

    // Get Custom Registration Fields
    const fields = await all('SELECT * FROM custom_fields WHERE exam_id = ? ORDER BY id ASC', [session.exam_id]);
    const parsedFields = fields.map(f => ({
      ...f,
      options: f.options ? safeParseJSON(f.options) : []
    }));

    res.json({
      session_id: session.id,
      session_code: session.session_code,
      session_name: session.session_name,
      status: session.status,
      results_released: session.results_released,
      exam_id: session.exam_id,
      exam_title: session.exam_title,
      description: session.description,
      duration_minutes: session.duration_minutes,
      custom_fields: parsedFields
    });
  } catch (err) {
    console.error('Session info error:', err);
    res.status(500).json({ error: 'Failed to retrieve session info' });
  }
});

// Start Exam -> Checks Duplicate Attempts, Enables Session Resume & Allows Result Lookup
router.post('/start-exam', async (req, res) => {
  try {
    const { session_id, student_details } = req.body;
    if (!session_id || !student_details) {
      return res.status(400).json({ error: 'Session ID and student details are required' });
    }

    const session = await get(`
      SELECT s.*, e.title as exam_title, e.duration_minutes, e.shuffle_questions, e.passing_score, e.show_results_immediately
      FROM exam_sessions s
      JOIN exams e ON s.exam_id = e.id
      WHERE s.id = ?
    `, [session_id]);

    if (!session) {
      return res.status(400).json({ error: 'Exam session not found' });
    }

    // Validate required custom fields
    const customFields = await all('SELECT * FROM custom_fields WHERE exam_id = ?', [session.exam_id]);
    for (const cf of customFields) {
      if (cf.is_required && (!student_details[cf.field_name] || student_details[cf.field_name].toString().trim() === '')) {
        return res.status(400).json({ error: `Please fill in required field: "${cf.field_name}"` });
      }
    }

    // Get Primary Student Name & Primary Reg ID
    let studentName = student_details['Full Name'] || student_details['Name'] || Object.values(student_details)[0] || 'Anonymous Candidate';
    let regId = student_details['Student Reg Number'] || student_details['Matric Number'] || student_details['Reg Number'] || studentName;

    // Fetch Questions
    let questions = await all('SELECT id, question_text, type, options, marks FROM questions WHERE exam_id = ?', [session.exam_id]);
    questions = questions.map(q => ({
      ...q,
      options: safeParseJSON(q.options)
    }));

    // Check if candidate already has an existing attempt for this session
    const existingSubmission = await get(`
      SELECT * FROM submissions
      WHERE session_id = ? AND (
        LOWER(student_name) = LOWER(?) OR
        LOWER(student_details) LIKE LOWER(?)
      )
      ORDER BY id DESC
    `, [session_id, studentName.trim(), `%${regId.trim()}%`]);

    if (existingSubmission) {
      if (existingSubmission.status === 'submitted') {
        const canView = session.show_results_immediately || session.results_released;

        if (canView) {
          const studentAnswers = safeParseJSON(existingSubmission.answers, {});
          const gradedBreakdown = questions.map(q => {
            const options = safeParseJSON(q.options);
            const correctAnswers = safeParseJSON(q.correct_answers);
            const studentAns = studentAnswers[q.id] !== undefined ? studentAnswers[q.id] : studentAnswers[q.id.toString()];
            const isCorrect = isAnswerCorrect(q.type, options, correctAnswers, studentAns);
            return {
              question_id: q.id,
              question_text: q.question_text,
              type: q.type,
              options,
              correct_answers: correctAnswers,
              student_answer: studentAns || [],
              is_correct: isCorrect,
              marks: q.marks,
              explanation: q.explanation || ''
            };
          });

          return res.json({
            submission_completed: true,
            submission_id: existingSubmission.id,
            can_view_results: true,
            student_name: existingSubmission.student_name,
            student_details: safeParseJSON(existingSubmission.student_details, {}),
            exam_title: session.exam_title,
            score: existingSubmission.score,
            total_marks: existingSubmission.total_marks,
            percentage: existingSubmission.percentage,
            passed: existingSubmission.passed === 1,
            breakdown: gradedBreakdown
          });
        }

        return res.status(400).json({
          error: `Candidate "${studentName}" has completed this exam. Results have not been released by the administrator yet.`
        });
      }

      // If in_progress and session is active, allow student to RESUME active exam!
      if (session.status === 'active') {
        const existingAnswers = safeParseJSON(existingSubmission.answers, {});
        return res.json({
          submission_id: existingSubmission.id,
          session_id: session.id,
          exam_title: session.exam_title,
          duration_minutes: session.duration_minutes,
          student_name: existingSubmission.student_name,
          student_details: safeParseJSON(existingSubmission.student_details, {}),
          questions,
          resumed_answers: existingAnswers,
          resumed_time_spent: existingSubmission.time_spent_seconds || 0,
          resumed_tab_switches: existingSubmission.tab_switch_count || 0
        });
      }
    }

    // If new candidate trying to start an ended session
    if (session.status === 'ended') {
      return res.status(400).json({
        error: 'This exam session has been ended by the administrator. New test attempts are no longer permitted.'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Exam session is not active' });
    }

    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: 'This exam does not have any questions yet.' });
    }

    if (session.shuffle_questions) {
      questions.sort(() => Math.random() - 0.5);
    }

    // Insert New Candidate Record
    const subResult = await run(`
      INSERT INTO submissions (
        session_id, student_name, student_details, answers,
        score, total_marks, percentage, passed, status,
        tab_switch_count, time_spent_seconds
      ) VALUES (?, ?, ?, '{}', 0, 0, 0, 0, 'in_progress', 0, 0)
    `, [
      session_id,
      studentName.trim(),
      JSON.stringify(student_details)
    ]);

    const submissionId = subResult.lastID;

    res.json({
      submission_id: submissionId,
      session_id: session.id,
      exam_title: session.exam_title,
      duration_minutes: session.duration_minutes,
      student_name: studentName,
      student_details,
      questions
    });
  } catch (err) {
    console.error('Start exam error:', err);
    res.status(500).json({ error: 'Failed to launch exam session' });
  }
});

// Periodic Heartbeat / Ping during exam
router.post('/ping-exam', async (req, res) => {
  try {
    const { submission_id, tab_switch_count, time_spent_seconds, answers } = req.body;
    if (!submission_id) return res.status(400).json({ error: 'Missing submission ID' });

    let updateSql = 'UPDATE submissions SET tab_switch_count = ?, time_spent_seconds = ?';
    let params = [tab_switch_count || 0, time_spent_seconds || 0];

    if (answers) {
      updateSql += ', answers = ?';
      params.push(JSON.stringify(answers));
    }

    updateSql += ' WHERE id = ? AND status = "in_progress"';
    params.push(submission_id);

    await run(updateSql, params);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Ping exam error:', err);
    res.status(500).json({ error: 'Failed to record ping' });
  }
});

// Submit Exam & Smart Auto-Grading
router.post('/submit-exam', async (req, res) => {
  try {
    const { submission_id, session_id, student_name, student_details, answers, tab_switch_count, time_spent_seconds } = req.body;

    if (!session_id || !answers) {
      return res.status(400).json({ error: 'Missing required submission data' });
    }

    const session = await get(`
      SELECT s.*, e.passing_score, e.show_results_immediately
      FROM exam_sessions s
      JOIN exams e ON s.exam_id = e.id
      WHERE s.id = ?
    `, [session_id]);

    if (!session) {
      return res.status(404).json({ error: 'Exam session not found' });
    }

    const questions = await all('SELECT * FROM questions WHERE exam_id = ?', [session.exam_id]);

    let earnedScore = 0;
    let totalMarks = 0;

    const gradedBreakdown = questions.map(q => {
      const options = safeParseJSON(q.options);
      const correctAnswers = safeParseJSON(q.correct_answers);
      const studentAns = answers[q.id] !== undefined ? answers[q.id] : answers[q.id.toString()];
      const qMarks = q.marks || 1;
      totalMarks += qMarks;

      const isCorrect = isAnswerCorrect(q.type, options, correctAnswers, studentAns);

      if (isCorrect) {
        earnedScore += qMarks;
      }

      return {
        question_id: q.id,
        question_text: q.question_text,
        type: q.type,
        options,
        correct_answers: correctAnswers,
        student_answer: studentAns || [],
        is_correct: isCorrect,
        marks: qMarks,
        explanation: q.explanation || ''
      };
    });

    const percentage = totalMarks > 0 ? (earnedScore / totalMarks) * 100 : 0;
    const passed = percentage >= session.passing_score ? 1 : 0;

    let targetSubmissionId = submission_id;

    if (targetSubmissionId) {
      await run(`
        UPDATE submissions SET
          student_name = ?,
          student_details = ?,
          answers = ?,
          score = ?,
          total_marks = ?,
          percentage = ?,
          passed = ?,
          status = 'submitted',
          tab_switch_count = ?,
          time_spent_seconds = ?,
          submitted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        student_name || 'Candidate',
        JSON.stringify(student_details || {}),
        JSON.stringify(answers),
        earnedScore,
        totalMarks,
        percentage,
        passed,
        tab_switch_count || 0,
        time_spent_seconds || 0,
        targetSubmissionId
      ]);
    } else {
      const result = await run(`
        INSERT INTO submissions (
          session_id, student_name, student_details, answers,
          score, total_marks, percentage, passed, status,
          tab_switch_count, time_spent_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
      `, [
        session_id,
        student_name || 'Candidate',
        JSON.stringify(student_details || {}),
        JSON.stringify(answers),
        earnedScore,
        totalMarks,
        percentage,
        passed,
        tab_switch_count || 0,
        time_spent_seconds || 0
      ]);
      targetSubmissionId = result.lastID;
    }

    const canViewNow = session.show_results_immediately || session.results_released;

    res.status(200).json({
      message: 'Exam submitted successfully',
      submission_id: targetSubmissionId,
      can_view_results: canViewNow,
      score: earnedScore,
      total_marks: totalMarks,
      percentage: percentage,
      passed: passed === 1,
      breakdown: canViewNow ? gradedBreakdown : null
    });
  } catch (err) {
    console.error('Submit exam error:', err);
    res.status(500).json({ error: 'Failed to submit exam' });
  }
});

// View Student Result
router.get('/result/:submissionId', async (req, res) => {
  try {
    const submission = await get(`
      SELECT sub.*, s.results_released, e.show_results_immediately, e.title as exam_title, e.passing_score, e.id as exam_id
      FROM submissions sub
      JOIN exam_sessions s ON sub.session_id = s.id
      JOIN exams e ON s.exam_id = e.id
      WHERE sub.id = ?
    `, [req.params.submissionId]);

    if (!submission) {
      return res.status(404).json({ error: 'Submission record not found' });
    }

    const canView = submission.show_results_immediately || submission.results_released;
    if (!canView) {
      return res.json({
        submission_id: submission.id,
        can_view_results: false,
        student_name: submission.student_name,
        exam_title: submission.exam_title,
        message: 'Your exam has been submitted successfully. Scores will be available once released by the Administrator.'
      });
    }

    const questions = await all('SELECT * FROM questions WHERE exam_id = ?', [submission.exam_id]);
    const studentAnswers = safeParseJSON(submission.answers, {});

    const breakdown = questions.map(q => {
      const options = safeParseJSON(q.options);
      const correctAnswers = safeParseJSON(q.correct_answers);
      const studentAns = studentAnswers[q.id] !== undefined ? studentAnswers[q.id] : studentAnswers[q.id.toString()];
      const isCorrect = isAnswerCorrect(q.type, options, correctAnswers, studentAns);

      return {
        question_id: q.id,
        question_text: q.question_text,
        type: q.type,
        options,
        correct_answers: correctAnswers,
        student_answer: studentAns || [],
        is_correct: isCorrect,
        marks: q.marks,
        explanation: q.explanation || ''
      };
    });

    res.json({
      submission_id: submission.id,
      can_view_results: true,
      student_name: submission.student_name,
      student_details: safeParseJSON(submission.student_details, {}),
      exam_title: submission.exam_title,
      score: submission.score,
      total_marks: submission.total_marks,
      percentage: submission.percentage,
      passed: submission.passed === 1,
      passing_score: submission.passing_score,
      time_spent_seconds: submission.time_spent_seconds,
      tab_switch_count: submission.tab_switch_count,
      submitted_at: submission.submitted_at,
      breakdown
    });
  } catch (err) {
    console.error('Fetch result error:', err);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

module.exports = {
  router,
  isAnswerCorrect,
  safeParseJSON
};
