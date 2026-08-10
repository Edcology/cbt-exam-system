const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run, all } = require('../db');
const { JWT_SECRET, authenticateAdminToken } = require('../middleware/auth');

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await get('SELECT * FROM admins WHERE username = ?', [username.trim()]);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Login successful', token, username: admin.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Dashboard Summary Stats
router.get('/stats', authenticateAdminToken, async (req, res) => {
  try {
    const totalExamsRow = await get('SELECT COUNT(*) as count FROM exams');
    const totalSessionsRow = await get('SELECT COUNT(*) as count FROM exam_sessions');
    const activeSessionsRow = await get("SELECT COUNT(*) as count FROM exam_sessions WHERE status = 'active'");
    const totalSubmissionsRow = await get('SELECT COUNT(*) as count FROM submissions');

    const recentSessions = await all(`
      SELECT s.*, e.title as exam_title,
             (SELECT COUNT(*) FROM submissions sub WHERE sub.session_id = s.id) as submission_count
      FROM exam_sessions s
      JOIN exams e ON s.exam_id = e.id
      ORDER BY s.created_at DESC LIMIT 5
    `);

    res.json({
      totalExams: totalExamsRow.count,
      totalSessions: totalSessionsRow.count,
      activeSessions: activeSessionsRow.count,
      totalSubmissions: totalSubmissionsRow.count,
      recentSessions
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard stats' });
  }
});

// Change Admin Password
router.post('/change-password', authenticateAdminToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required' });
    }

    const admin = await get('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await run('UPDATE admins SET password = ? WHERE id = ?', [hashedNew, req.admin.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;
