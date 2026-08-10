const express = require('express');
const router = express.Router();
const { get, run, all } = require('../db');

// Robust Answer Matching Helper Function
function isAnswerCorrect(qType, options, correctAnswersRaw, studentAnsRaw) {
  if (!studentAnsRaw) return false;

  const optionsList = Array.isArray(options) ? options.map(o => o.toString().trim()) : [];
  const correctList = Array.isArray(correctAnswersRaw) ? correctAnswersRaw : [correctAnswersRaw];
  const studentList = Array.isArray(studentAnsRaw) ? studentAnsRaw : [studentAnsRaw];

  if (studentList.length === 0 || correctList.length === 0) return false;

  // Build a Set of acceptable correct strings (option text, letters A/B/C/D, indices)
  const acceptableCorrect = new Set();

  for (const corr of correctList) {
    const corrStr = corr.toString().trim();
    const upperCorr = corrStr.toUpperCase();

    // 1. Raw string (lowercase)
    acceptableCorrect.add(corrStr.toLowerCase());

    // 2. Letter A, B, C, D
    if (['A', 'B', 'C', 'D'].includes(upperCorr)) {
      const idx = upperCorr.charCodeAt(0) - 65;
      if (optionsList[idx]) {
        acceptableCorrect.add(optionsList[idx].toLowerCase());
      }
      acceptableCorrect.add(upperCorr);
    }
    // 3. Option Index 0, 1, 2, 3
    else if (!isNaN(parseInt(corrStr)) && parseInt(corrStr) >= 0 && parseInt(corrStr) < optionsList.length) {
      const idx = parseInt(corrStr);
      if (optionsList[idx]) {
        acceptableCorrect.add(optionsList[idx].toLowerCase());
      }
      acceptableCorrect.add(String.fromCharCode(65 + idx)); // Add 'A', 'B'...
    }
  }

  // Normalize student answers
  const studentChoices = studentList.map(st => st.toString().trim());

  if (qType === 'single_choice' || qType === 'true_false') {
    const sChoice = studentChoices[0];
    if (!sChoice) return false;
    const sLower = sChoice.toLowerCase();

    // Direct match
    if (acceptableCorrect.has(sLower)) return true;

    // Check if student choice is option text and matches letter in key
    const studentOptIdx = optionsList.findIndex(o => o.toLowerCase() === sLower);
    if (studentOptIdx !== -1) {
      const letter = String.fromCharCode(65 + studentOptIdx);
      if (acceptableCorrect.has(letter)) return true;
    }
    return false;
  } else if (qType === 'multiple_choice') {
    let matchCount = 0;
    for (const sChoice of studentChoices) {
      const sLower = sChoice.toLowerCase();
      let matched = acceptableCorrect.has(sLower);

      if (!matched) {
        const studentOptIdx = optionsList.findIndex(o => o.toLowerCase() === sLower);
        if (studentOptIdx !== -1) {
          const letter = String.fromCharCode(65 + studentOptIdx);
          if (acceptableCorrect.has(letter)) matched = true;
        }
      }
      if (matched) matchCount++;
    }
    // For multiple choice, candidate must match all correct answers
    const expectedCount = Math.min(correctList.length, optionsList.length);
    return matchCount >= expectedCount && studentChoices.length === expectedCount;
  }

  return false;
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

    if (session.status !== 'active') {
      return res.status(400).json({
        error: session.status === 'draft'
          ? 'This exam session has not been started yet. Please wait for the administrator.'
          : session.status === 'paused'
          ? 'This exam session is currently paused by the administrator.'
          : 'This exam session has been ended by the administrator.'
      });
    }

    // Get Custom Registration Fields
    const fields = await all('SELECT * FROM custom_fields WHERE exam_id = ? ORDER BY id ASC', [session.exam_id]);
    const parsedFields = fields.map(f => ({
      ...f,
      options: f.options ? JSON.parse(f.options) : []
    }));

    res.json({
      session_id: session.id,
      session_code: session.session_code,
      session_name: session.session_name,
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

// Start Exam -> Registers Candidate in DB immediately with 'in_progress' status!
router.post('/start-exam', async (req, res) => {
  try {
    const { session_id, student_details } = req.body;
    if (!session_id || !student_details) {
      return res.status(400).json({ error: 'Session ID and student details are required' });
    }

    const session = await get(`
      SELECT s.*, e.title as exam_title, e.duration_minutes, e.shuffle_questions
      FROM exam_sessions s
      JOIN exams e ON s.exam_id = e.id
      WHERE s.id = ? AND s.status = 'active'
    `, [session_id]);

    if (!session) {
      return res.status(400).json({ error: 'Exam session is not active' });
    }

    // Validate required custom fields
    const customFields = await all('SELECT * FROM custom_fields WHERE exam_id = ?', [session.exam_id]);
    for (const cf of customFields) {
      if (cf.is_required && (!student_details[cf.field_name] || student_details[cf.field_name].toString().trim() === '')) {
        return res.status(400).json({ error: `Please fill in required field: "${cf.field_name}"` });
      }
    }

    // Get Primary Student Name
    let studentName = student_details['Full Name'] || student_details['Name'] || Object.values(student_details)[0] || 'Anonymous Candidate';

    // Insert Live Candidate Session Record in DB immediately!
    const subResult = await run(`
      INSERT INTO submissions (
        session_id, student_name, student_details, answers,
        score, total_marks, percentage, passed, status,
        tab_switch_count, time_spent_seconds
      ) VALUES (?, ?, ?, '{}', 0, 0, 0, 0, 'in_progress', 0, 0)
    `, [
      session_id,
      studentName,
      JSON.stringify(student_details)
    ]);

    const submissionId = subResult.lastID;

    // Fetch Questions
    let questions = await all('SELECT id, question_text, type, options, marks FROM questions WHERE exam_id = ?', [session.exam_id]);

    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: 'This exam does not have any questions yet.' });
    }

    // Parse options for frontend
    questions = questions.map(q => ({
      ...q,
      options: JSON.parse(q.options)
    }));

    // Shuffle questions if configured
    if (session.shuffle_questions) {
      questions.sort(() => Math.random() - 0.5);
    }

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
      const options = JSON.parse(q.options);
      const correctAnswers = JSON.parse(q.correct_answers);
      const studentAns = answers[q.id];
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
    const studentAnswers = JSON.parse(submission.answers || '{}');

    const breakdown = questions.map(q => {
      const options = JSON.parse(q.options);
      const correctAnswers = JSON.parse(q.correct_answers);
      const studentAns = studentAnswers[q.id];
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
      student_details: JSON.parse(submission.student_details),
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
  isAnswerCorrect
};
