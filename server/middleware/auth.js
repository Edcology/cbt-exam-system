const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-cbt-secret-key-2026';

function authenticateAdminToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Support Authorization header OR token query parameter for file downloads
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token' });
    }
    req.admin = user;
    next();
  });
}

module.exports = {
  JWT_SECRET,
  authenticateAdminToken
};
