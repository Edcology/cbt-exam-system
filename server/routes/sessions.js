const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const { get, run, all } = require('../db');
const { authenticateAdminToken } = require('../middleware/auth');
const { isAnswerCorrect } = require('./student');

// Function to generate random 6-character session code
function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CBT-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// List all sessions
router.get('/', authenticateAdminToken, async (req, res) => {
  try {
    const sessions = await all(`
      SELECT s.*, e.title as exam_title, e.duration_minutes, e.passing_score, e.show_results_immediately,
        (SELECT COUNT(*) FROM submissions sub WHERE sub.session_id = s.id) as total_submissions
      FROM exam_sessions s
      JOIN exams e ON s.exam_id = e.id
      ORDER BY s.created_at DESC
    `);
    res.json(sessions);
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch exam sessions' });
  }
});

// Create new session
router.post('/', authenticateAdminToken, async (req, res) => {
  try {
    const { exam_id, session_name } = req.body;
    if (!exam_id || !session_name) {
      return res.status(400).json({ error: 'Exam ID and session name are required' });
    }

    const exam = await get('SELECT * FROM exams WHERE id = ?', [exam_id]);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    let sessionCode = generateSessionCode();
    let existing = await get('SELECT * FROM exam_sessions WHERE session_code = ?', [sessionCode]);
    while (existing) {
      sessionCode = generateSessionCode();
      existing = await get('SELECT * FROM exam_sessions WHERE session_code = ?', [sessionCode]);
    }

    const result = await run(`
      INSERT INTO exam_sessions (exam_id, session_code, session_name, status, results_released)
      VALUES (?, ?, ?, 'draft', 0)
    `, [exam_id, sessionCode, session_name.trim()]);

    res.status(201).json({
      message: 'Session created successfully',
      id: result.lastID,
      session_code: sessionCode
    });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session status (draft -> active -> paused -> ended)
router.patch('/:id/status', authenticateAdminToken, async (req, res) => {
  try {
    const { status } = req.body; // 'active', 'paused', 'ended'
    if (!['draft', 'active', 'paused', 'ended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const session = await get('SELECT * FROM exam_sessions WHERE id = ?', [req.params.id]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let updateSql = 'UPDATE exam_sessions SET status = ? WHERE id = ?';
    let params = [status, req.params.id];

    if (status === 'active' && !session.start_time) {
      updateSql = 'UPDATE exam_sessions SET status = ?, start_time = CURRENT_TIMESTAMP WHERE id = ?';
    } else if (status === 'ended' && !session.end_time) {
      updateSql = 'UPDATE exam_sessions SET status = ?, end_time = CURRENT_TIMESTAMP WHERE id = ?';
    }

    await run(updateSql, params);
    res.json({ message: `Session status changed to ${status}` });
  } catch (err) {
    console.error('Update session status error:', err);
    res.status(500).json({ error: 'Failed to update session status' });
  }
});

// Toggle Results Release Mode for Session (0 = withheld, 1 = released)
router.patch('/:id/results-release', authenticateAdminToken, async (req, res) => {
  try {
    const { results_released } = req.body; // boolean or 0/1
    const releaseVal = results_released ? 1 : 0;

    await run('UPDATE exam_sessions SET results_released = ? WHERE id = ?', [releaseVal, req.params.id]);
    res.json({
      message: releaseVal ? 'Results released to candidates!' : 'Results withheld by admin',
      results_released: releaseVal
    });
  } catch (err) {
    console.error('Release results error:', err);
    res.status(500).json({ error: 'Failed to update results release status' });
  }
});

// Get Submissions for Session
router.get('/:id/submissions', authenticateAdminToken, async (req, res) => {
  try {
    const session = await get(`
      SELECT s.*, e.title as exam_title, e.passing_score
      FROM exam_sessions s
      JOIN exams e ON s.exam_id = e.id
      WHERE s.id = ?
    `, [req.params.id]);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const submissions = await all(`
      SELECT * FROM submissions WHERE session_id = ? ORDER BY submitted_at DESC
    `, [req.params.id]);

    const parsedSubmissions = submissions.map(sub => ({
      ...sub,
      student_details: JSON.parse(sub.student_details),
      answers: JSON.parse(sub.answers)
    }));

    res.json({
      session,
      submissions: parsedSubmissions
    });
  } catch (err) {
    console.error('Get session submissions error:', err);
    res.status(500).json({ error: 'Failed to fetch session submissions' });
  }
});

// Export Session Submissions Grade Sheet as Excel Spreadsheet
router.get('/:id/export-excel', authenticateAdminToken, async (req, res) => {
  try {
    const session = await get(`
      SELECT s.*, e.title as exam_title, e.passing_score
      FROM exam_sessions s
      JOIN exams e ON s.exam_id = e.id
      WHERE s.id = ?
    `, [req.params.id]);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const submissions = await all(`
      SELECT * FROM submissions WHERE session_id = ? ORDER BY submitted_at DESC
    `, [req.params.id]);

    const exportRows = submissions.map((sub, index) => {
      const details = JSON.parse(sub.student_details);
      const row = {
        S_N: index + 1,
        Student_Name: sub.student_name,
        ...details,
        Score: `${sub.score} / ${sub.total_marks}`,
        Percentage: `${sub.percentage.toFixed(1)}%`,
        Status: sub.passed ? 'PASSED' : 'FAILED',
        Tab_Switches: sub.tab_switch_count,
        Time_Spent: `${Math.floor(sub.time_spent_seconds / 60)}m ${sub.time_spent_seconds % 60}s`,
        Submitted_At: new Date(sub.submitted_at).toLocaleString()
      };
      return row;
    });

    const worksheet = xlsx.utils.json_to_sheet(exportRows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Grade_Sheet");

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const cleanTitle = session.session_name.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=CBT_Results_${cleanTitle}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Export excel error:', err);
    res.status(500).json({ error: 'Failed to export grade sheet' });
  }
});

// Delete Session
router.delete('/:id', authenticateAdminToken, async (req, res) => {
  try {
    await run('DELETE FROM exam_sessions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Session deleted successfully' });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Re-Grade All Submissions for Session (Fixes 0 scores retroactively)
router.post('/:id/regrade', authenticateAdminToken, async (req, res) => {
  try {
    const session = await get(`
      SELECT s.*, e.passing_score
      FROM exam_sessions s
      JOIN exams e ON s.exam_id = e.id
      WHERE s.id = ?
    `, [req.params.id]);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const questions = await all('SELECT * FROM questions WHERE exam_id = ?', [session.exam_id]);
    const submissions = await all('SELECT * FROM submissions WHERE session_id = ? AND status = "submitted"', [req.params.id]);

    let regradedCount = 0;

    for (const sub of submissions) {
      const studentAnswers = JSON.parse(sub.answers || '{}');
      let earnedScore = 0;
      let totalMarks = 0;

      for (const q of questions) {
        const options = JSON.parse(q.options);
        const correctAnswers = JSON.parse(q.correct_answers);
        const studentAns = studentAnswers[q.id];
        const qMarks = q.marks || 1;
        totalMarks += qMarks;

        if (isAnswerCorrect(q.type, options, correctAnswers, studentAns)) {
          earnedScore += qMarks;
        }
      }

      const percentage = totalMarks > 0 ? (earnedScore / totalMarks) * 100 : 0;
      const passed = percentage >= session.passing_score ? 1 : 0;

      await run(`
        UPDATE submissions SET
          score = ?,
          total_marks = ?,
          percentage = ?,
          passed = ?
        WHERE id = ?
      `, [earnedScore, totalMarks, percentage, passed, sub.id]);

      regradedCount++;
    }

    res.json({ message: `Successfully re-graded ${regradedCount} student submission(s)!`, count: regradedCount });
  } catch (err) {
    console.error('Regrade error:', err);
    res.status(500).json({ error: 'Failed to re-grade submissions' });
  }
});

module.exports = router;
