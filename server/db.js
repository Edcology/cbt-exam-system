const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'cbt_database.sqlite');
const db = new sqlite3.Database(dbPath);

// Promisify database operations
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Database Initialization & Migrations
async function initDb() {
  db.serialize(async () => {
    // Admins Table
    await run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Default Seed Admin Account: username = "admin", password = "admin123"
    const existingAdmin = await get(`SELECT * FROM admins WHERE username = ?`, ['admin']);
    if (!existingAdmin) {
      const hash = await bcrypt.hash('admin123', 10);
      await run(`INSERT INTO admins (username, password) VALUES (?, ?)`, ['admin', hash]);
      console.log('⚡ Seeded default admin account: admin / admin123');
    }

    // Exams Table
    await run(`
      CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER NOT NULL DEFAULT 30,
        passing_score INTEGER NOT NULL DEFAULT 50,
        shuffle_questions INTEGER NOT NULL DEFAULT 1,
        show_results_immediately INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Custom Registration Fields Table
    await run(`
      CREATE TABLE IF NOT EXISTS custom_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        field_type TEXT NOT NULL DEFAULT 'text',
        options TEXT,
        is_required INTEGER DEFAULT 1,
        FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
      )
    `);

    // Questions Table
    await run(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'single_choice',
        options TEXT NOT NULL,
        correct_answers TEXT NOT NULL,
        marks INTEGER DEFAULT 1,
        explanation TEXT,
        FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
      )
    `);

    // Exam Sessions Table
    await run(`
      CREATE TABLE IF NOT EXISTS exam_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        session_code TEXT UNIQUE NOT NULL,
        session_name TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        results_released INTEGER DEFAULT 0,
        start_time DATETIME,
        end_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
      )
    `);

    // Student Submissions Table (Includes candidate_token for live in_progress tracking)
    await run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        student_name TEXT NOT NULL,
        student_details TEXT NOT NULL,
        answers TEXT DEFAULT '{}',
        score REAL NOT NULL DEFAULT 0,
        total_marks REAL NOT NULL DEFAULT 0,
        percentage REAL NOT NULL DEFAULT 0,
        passed INTEGER DEFAULT 0,
        status TEXT DEFAULT 'in_progress',
        tab_switch_count INTEGER DEFAULT 0,
        time_spent_seconds INTEGER DEFAULT 0,
        candidate_token TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ SQLite Database initialized with live candidate tracking.');
  });
}

module.exports = {
  db,
  run,
  get,
  all,
  initDb
};
