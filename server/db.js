const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const committedDbPath = path.resolve(__dirname, 'cbt_database.sqlite');
let dbPath = committedDbPath;

if (process.env.DB_PATH) {
  const targetDir = path.dirname(process.env.DB_PATH);
  if (fs.existsSync(targetDir)) {
    dbPath = process.env.DB_PATH;
    // Seed persistent disk with committed database if persistent file does not exist yet
    if (!fs.existsSync(dbPath) && fs.existsSync(committedDbPath)) {
      try {
        console.log(`Seeding persistent disk database at ${dbPath} from committed repository template...`);
        fs.copyFileSync(committedDbPath, dbPath);
      } catch (err) {
        console.error('Failed to copy database template:', err);
      }
    }
  }
}

console.log('Using SQLite Database File:', dbPath);
const db = new sqlite3.Database(dbPath);

// Promisify database operations
const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Initialize database tables
async function initDb() {
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure default admin exists (admin / admin123)
    const adminCount = await get('SELECT COUNT(*) as count FROM admins');
    if (adminCount.count === 0) {
      const defaultHash = await bcrypt.hash('admin123', 10);
      await run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['admin', defaultHash]);
      console.log('Default admin account initialized: admin / admin123');
    }

    await run(`
      CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER DEFAULT 60,
        passing_score INTEGER DEFAULT 50,
        shuffle_questions INTEGER DEFAULT 1,
        show_results_immediately INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        type TEXT DEFAULT 'single_choice',
        options TEXT NOT NULL,
        correct_answers TEXT NOT NULL,
        marks INTEGER DEFAULT 1,
        explanation TEXT,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS custom_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        field_type TEXT DEFAULT 'text',
        options TEXT,
        is_required INTEGER DEFAULT 1,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS exam_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        session_name TEXT NOT NULL,
        session_code TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'draft',
        results_released INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        student_name TEXT NOT NULL,
        student_details TEXT NOT NULL,
        answers TEXT NOT NULL,
        score REAL DEFAULT 0,
        total_marks REAL DEFAULT 0,
        percentage REAL DEFAULT 0,
        passed INTEGER DEFAULT 0,
        status TEXT DEFAULT 'submitted',
        tab_switch_count INTEGER DEFAULT 0,
        time_spent_seconds INTEGER DEFAULT 0,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES exam_sessions (id) ON DELETE CASCADE
      )
    `);

    console.log('✅ SQLite Database initialized with live candidate tracking.');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

initDb();

module.exports = {
  db,
  get,
  all,
  run,
  initDb
};
